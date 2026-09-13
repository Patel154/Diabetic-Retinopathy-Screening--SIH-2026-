import io,sys,unittest,threading,urllib.request,urllib.error,json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server
from PIL import Image
class Checks(unittest.TestCase):
 def test_invalid_bytes(self):
  with self.assertRaises(Exception):server.analyze(b'not an image')
 def test_small_image(self):
  b=io.BytesIO();Image.new('RGB',(50,50)).save(b,format='PNG')
  with self.assertRaisesRegex(ValueError,'too small'):server.analyze(b.getvalue())
 def test_python_fallback_without_matlab(self):
  b=io.BytesIO();Image.new('RGB',(224,224)).save(b,format='PNG')
  with patch.object(server,'matlab_exe',return_value=None):
   result=server.analyze(b.getvalue())
   self.assertEqual(result['grade'],None)
   self.assertIn('MATLAB was not found',result['note'])
 def test_routes(self):
  s=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
  t=threading.Thread(target=s.serve_forever,daemon=True);t.start();base=f'http://127.0.0.1:{s.server_port}'
  try:
   for path in ['/','/app.js','/style.css','/api/status']:
    with urllib.request.urlopen(base+path) as r:self.assertEqual(r.status,200)
   for path in ['/server.py','/../server.py']:
    with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(base+path)
    self.assertEqual(e.exception.code,404)
   request=urllib.request.Request(base+'/api/screen',data=b'x',headers={'Origin':'https://example.com'})
   with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(request)
   self.assertEqual(e.exception.code,403)
  finally:s.shutdown();s.server_close()
if __name__=='__main__':unittest.main()
