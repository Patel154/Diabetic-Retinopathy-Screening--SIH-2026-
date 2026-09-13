"""Loopback-only MATLAB screening bridge. No external AI service."""
import base64, io, json, os, shutil, sqlite3, subprocess, tempfile, threading
from urllib.parse import urlparse
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError
ROOT=Path(__file__).resolve().parent
LOCK=threading.Lock()
DB=ROOT/'retina_bridge.db'
Image.MAX_IMAGE_PIXELS=25_000_000

def save_patient(data):
    required=['patientId','name','age','diabetes','eye','consent']
    if any(not str(data.get(key,'')).strip() for key in required):
        raise ValueError('Complete the required patient details before screening.')
    if data.get('consent') is not True:
        raise ValueError('Consent or authorised demonstration confirmation is required.')
    try:
        age=int(data['age'])
    except (TypeError,ValueError):
        raise ValueError('Age must be a whole number.')
    if not 0 < age <= 120:
        raise ValueError('Enter an age between 1 and 120.')
    with sqlite3.connect(DB) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL,
            contact TEXT NOT NULL DEFAULT '', diabetes TEXT NOT NULL,
            diabetes_years TEXT, medications TEXT, symptoms TEXT,
            gender TEXT, hypertension TEXT, prior_dr TEXT, last_exam TEXT,
            previous_treatment TEXT, history_notes TEXT, eye TEXT,
            consent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)''')
        columns={row[1] for row in db.execute('PRAGMA table_info(patients)')}
        migrations={
            'gender': "ALTER TABLE patients ADD COLUMN gender TEXT",
            'hypertension': "ALTER TABLE patients ADD COLUMN hypertension TEXT",
            'prior_dr': "ALTER TABLE patients ADD COLUMN prior_dr TEXT",
            'last_exam': "ALTER TABLE patients ADD COLUMN last_exam TEXT",
            'previous_treatment': "ALTER TABLE patients ADD COLUMN previous_treatment TEXT",
            'history_notes': "ALTER TABLE patients ADD COLUMN history_notes TEXT",
            'eye': "ALTER TABLE patients ADD COLUMN eye TEXT",
            'consent': "ALTER TABLE patients ADD COLUMN consent INTEGER NOT NULL DEFAULT 0",
        }
        for name, statement in migrations.items():
            if name not in columns:
                db.execute(statement)
        db.execute('''INSERT OR REPLACE INTO patients
            (patient_id,name,age,contact,diabetes,diabetes_years,medications,
             symptoms,gender,hypertension,prior_dr,last_exam,previous_treatment,
             history_notes,eye,consent,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))''',
            (data['patientId'].strip(), data['name'].strip(), age,
             str(data.get('contact', data.get('phone', ''))).strip(),
             data['diabetes'].strip(), str(data.get('diabetesYears', data.get('duration', ''))).strip(),
             str(data.get('medications', '')).strip(), data.get('symptoms', '').strip(),
             data.get('gender', '').strip(), data.get('hypertension', '').strip(),
             data.get('priorDR', '').strip(), data.get('lastExam', '').strip(),
             data.get('treatment', data.get('previousTreatment', '')).strip(),
             data.get('history', data.get('historyNotes', '')).strip(),
             data['eye'].strip(), 1))

def matlab_exe():
    value=os.environ.get('MATLAB_EXE','matlab')
    found=shutil.which(value) or (value if Path(value).is_file() else None)
    if found:
        return found
    if os.name=='nt':
        try:
            import winreg
            for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
                with winreg.OpenKey(hive, r'SOFTWARE\MathWorks\MATLAB') as versions:
                    for index in range(winreg.QueryInfoKey(versions)[0]):
                        version=winreg.EnumKey(versions,index)
                        with winreg.OpenKey(versions,version) as entry:
                            root,_=winreg.QueryValueEx(entry,'MATLABROOT')
                        candidate=Path(root)/'bin'/'matlab.exe'
                        if candidate.is_file():
                            return str(candidate)
        except (FileNotFoundError, OSError):
            pass
    return None

def python_quality(rgb, job):
    gray=rgb.convert('L')
    pixels=list(gray.getdata())
    coverage=sum(value > 10 for value in pixels)/len(pixels)
    brightness=sum(pixels)/(255*len(pixels))
    mean=sum(pixels)/len(pixels)
    focus=sum((value-mean)**2 for value in pixels)/(255**2*len(pixels))
    accepted=coverage > 0.25 and 0.08 < brightness < 0.92 and focus > 0.00003
    feedback='Heuristic quality checks passed. A reviewer must confirm fundus identity and field of view.'
    if not accepted:
        feedback='Recapture: check focus, lighting and retinal coverage. No DR grade is issued.'
    enhanced=ImageOps.autocontrast(ImageEnhance.Contrast(rgb).enhance(1.15))
    enhanced.save(job/'enhanced.png')
    edges=gray.filter(ImageFilter.FIND_EDGES).point(lambda value: 255 if value > 35 else 0)
    edges.save(job/'vessels.png')
    return {
        'status':'Quality assessment only (Python fallback)',
        'quality':{
            'coverage':coverage,
            'brightness':brightness,
            'focus':focus,
            'accepted':accepted,
            'feedback':feedback
        },
        'grade':None,
        'label':'',
        'score':None,
        'note':'MATLAB was not found. Configure MATLAB_EXE to enable the trained severity model. No severity or confidence was invented.'
    }

def analyze(raw):
    with Image.open(io.BytesIO(raw)) as im:
        if im.format not in ('PNG','JPEG'): raise ValueError('Choose a PNG or JPEG fundus image.')
        if min(im.size)<224: raise ValueError('Image is too small. Use an image at least 224 × 224 pixels.')
        im.load(); rgb=im.convert('RGB')
    if not LOCK.acquire(blocking=False): raise RuntimeError('Another image is being processed. Please wait.')
    try:
        with tempfile.TemporaryDirectory(prefix='retina_') as d:
            d=Path(d); rgb.save(d/'input.png')
            if not matlab_exe():
                result=python_quality(rgb,d)
                for name in ['enhanced','vessels']:
                    f=d/(name+'.png')
                    result[name]='data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()
                return result
            env=os.environ.copy(); env['DR_JOB_DIR']=str(d); env['DR_PROJECT_DIR']=str(ROOT)
            command=[matlab_exe()]
            if os.name=='nt': command+=['-wait']
            command+=['-sd',str(ROOT/'matlab'),'-batch','screen_image']
            run=subprocess.run(command,env=env,capture_output=True,text=True,timeout=300)
            if run.returncode or not (d/'result.json').exists():
                print(run.stdout[-4000:],run.stderr[-2000:])
                raise RuntimeError('MATLAB could not finish. Check the server window for toolbox or model errors.')
            result=json.loads((d/'result.json').read_text())
            for name in ['enhanced','heatmap','vessels']:
                f=d/(name+'.png')
                if f.exists(): result[name]='data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()
            return result
    finally: LOCK.release()

class Handler(BaseHTTPRequestHandler):
    def send(self,status,data,kind='application/json'):
        body=json.dumps(data,allow_nan=False).encode() if kind=='application/json' else data
        self.send_response(status); self.send_header('Content-Type',kind)
        self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path=='/api/status':
            matlab=matlab_exe()
            model=ROOT/'models'/'dr_model.mat'
            return self.send(200,{'matlab':bool(matlab),'matlabPath':matlab or '',
                                   'model':model.is_file(),'modelPath':str(model)})
        allowed={'/':'index.html','/style.css':'style.css','/app.js':'app.js'}
        if self.path not in allowed:return self.send(404,{'error':'Not found'})
        f=ROOT/'web'/allowed[self.path]
        self.send(200,f.read_bytes(),{'html':'text/html; charset=utf-8','css':'text/css','js':'text/javascript'}[f.suffix[1:]])
    def do_POST(self):
        if self.path=='/api/patients':
            try:
                size=int(self.headers.get('Content-Length','0'))
                data=json.loads(self.rfile.read(size))
                save_patient(data)
                return self.send(201,{'saved':True,'patientId':data['patientId'].strip()})
            except (ValueError, json.JSONDecodeError) as e:
                return self.send(400,{'error':str(e)})
            except sqlite3.Error:
                return self.send(500,{'error':'Could not save the patient record locally.'})
        if self.path!='/api/screen':return self.send(404,{'error':'Not found'})
        origin=self.headers.get('Origin')
        host=self.headers.get('Host','')
        if origin is not None and urlparse(origin).netloc != host:
            return self.send(403,{'error':'Use the local website.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=15*1024*1024:return self.send(413,{'error':'Choose an image under 15 MB.'})
            self.send(200,analyze(self.rfile.read(size)))
        except (ValueError,UnidentifiedImageError,Image.DecompressionBombError) as e:self.send(400,{'error':str(e)})
        except subprocess.TimeoutExpired:self.send(504,{'error':'MATLAB exceeded 5 minutes. Check MATLAB and try again.'})
        except RuntimeError as e:self.send(503,{'error':str(e)})
        except Exception:
            import traceback; traceback.print_exc(); self.send(500,{'error':'Processing failed. Check the server window.'})
if __name__=='__main__':
    host=os.environ.get('RETINA_BRIDGE_HOST','127.0.0.1')
    print(f'RetinaBridge: http://{host}:5000 — Ctrl+C to stop')
    ThreadingHTTPServer((host,5000),Handler).serve_forever()
