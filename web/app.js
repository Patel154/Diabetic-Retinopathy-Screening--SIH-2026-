'use strict';
const $=id=>document.getElementById(id);
const grades=['No DR','Mild','Moderate','Severe','Proliferative'];
const meaning=[
 'The model selected the no-DR class. This does not rule out diabetic retinopathy, other eye disease or findings outside the captured field.',
 'The model selected the mild DR class. This is below the prototype’s Grade 2+ referral cutoff; it is not an all-clear result.',
 'The model selected the moderate DR class. This falls within the prototype’s referable category, defined as Grades 2–4.',
 'The model selected the severe DR class. This falls within the prototype’s referable category, defined as Grades 2–4.',
 'The model selected the proliferative DR class. This falls within the prototype’s referable category. The label does not independently confirm new vessel growth.'
];
const careGuidance=[
 ['No medicine is automatically indicated by this screening grade.','Arrange a routine comprehensive dilated eye examination according to the clinician’s schedule.','Continue prescribed diabetes and blood-pressure care; do not change doses from this report.','Seek earlier review if vision changes, floaters or other symptoms develop.'],
 ['Ask an eye-care professional to review this result and the original image.','Arrange a timely dilated eye examination and document the follow-up plan.','Continue existing prescribed diabetes and blood-pressure treatment unless the treating clinician changes it.','Do not self-start eye drops, injections, or other treatment based on the model grade.'],
 ['Prompt ophthalmology assessment is recommended because this is in the prototype’s referable range.','Bring the original image, patient history, and current medicine list to the appointment.','Only an eye specialist can determine whether laser, injections, surgery, or observation is appropriate.','Seek urgent care for sudden vision loss, a curtain-like shadow, severe eye pain, or many new floaters.'],
 ['Urgent ophthalmology assessment is recommended because this is the highest model grade.','Do not delay referral while waiting for another automated result.','Only an eye specialist can determine whether treatment such as injections, laser, or surgery is appropriate.','Seek urgent care immediately for sudden vision loss, a curtain-like shadow, severe eye pain, or many new floaters.']
];
const noGradeGuidance=['Repeat the image only after the quality issue is corrected.','Do not interpret this result as a negative screening.','Arrange clinical review if symptoms or concerns are present.'];
let file=null,originalUrl=null,busy=false,selection=0,reportReady=false,patientSnapshot=null;
function message(text,error=false){$('message').hidden=!text;$('message').textContent=text;$('message').classList.toggle('error',error)}
function setBusy(value){busy=value;for(const id of ['run','file','remove','case-id','eye','edit-patient','new-patient'])$(id).disabled=value; $('run').disabled=value||!file||!patientSnapshot;$('run').textContent=value?'Processing in MATLAB…':'Assess & screen →';$('report').setAttribute('aria-busy',String(value))}
async function status(){try{const r=await fetch('/api/status');if(!r.ok)throw Error();const s=await r.json();$('status').textContent=`MATLAB: ${s.matlab?'found':'not found'} · Model: ${s.model?'available':'not available'}`;}catch{$('status').textContent='Server unavailable. Start python server.py.'}}
$('refresh-status').onclick=status;status();
function clearReport(){reportReady=false;$('report').hidden=true;$('empty').hidden=false;$('print').disabled=true;$('notes').value='';$('reviewer-name').value='';$('disposition').selectedIndex=0;}
async function selectFile(chosen){if(busy)return;const ticket=++selection;if(patientSnapshot)setStep('image');clearReport();message('');file=null;$('run').disabled=true;$('selected').hidden=true;if(originalUrl){URL.revokeObjectURL(originalUrl);originalUrl=null}
 if(!chosen)return;
 if(chosen.size>15*1024*1024){message('This image is larger than 15 MB. Choose a smaller PNG or JPG.',true);return}
 if(!['image/png','image/jpeg'].includes(chosen.type)){message('Please choose a PNG or JPG image.',true);return}
 const url=URL.createObjectURL(chosen);const pic=new Image();pic.src=url;
 try{await pic.decode();if(ticket!==selection){URL.revokeObjectURL(url);return}if(Math.min(pic.naturalWidth,pic.naturalHeight)<224)throw Error('Use an image at least 224 × 224 pixels.');if(pic.naturalWidth*pic.naturalHeight>25000000)throw Error('Use an image with no more than 25 million pixels.');file=chosen;originalUrl=url;$('preview').src=url;$('selected').hidden=false;$('filename').textContent=chosen.name;$('filemeta').textContent=`${pic.naturalWidth} × ${pic.naturalHeight} px · ${(chosen.size/1024/1024).toFixed(2)} MB`;$('run').disabled=!patientSnapshot;}catch(e){URL.revokeObjectURL(url);if(ticket===selection)message(e.message||'This file could not be read as an image.',true)}
}
$('file').onchange=e=>selectFile(e.target.files[0]);
$('remove').onclick=()=>{$('file').value='';selectFile(null)};
$('dropzone').ondragover=e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('drag')};
$('dropzone').ondragleave=()=>{$('dropzone').classList.remove('drag')};
$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('drag');if(!busy){$('file').value='';selectFile(e.dataTransfer.files[0])}};
function imageCard(title,src,description){const f=document.createElement('figure');let view;if(src){view=document.createElement('button');view.type='button';view.className='imagebutton';view.setAttribute('aria-label','Enlarge '+title);const i=document.createElement('img');i.src=src;i.alt=title;view.append(i);view.onclick=()=>{$('lightbox-title').textContent=title;$('lightbox-image').src=src;$('lightbox-image').alt=title;$('lightbox-caption').textContent=description;$('lightbox').showModal()}}else{view=document.createElement('div');view.className='unavailable';view.textContent='Not returned by the analysis'}const caption=document.createElement('figcaption'),strong=document.createElement('strong'),p=document.createElement('p');strong.textContent=title;p.textContent=description;caption.append(strong,p);f.append(view,caption);return f;}
function qualityMetric(value,id,format,detail){const valid=typeof value==='number'&&Number.isFinite(value);$(id+'-value').textContent=valid?format(value):'Unavailable';$(id+'-detail').textContent=valid?detail(value):'Not returned by the backend.'}
function render(d,meta){renderPatient();setStep('review');const q=d.quality||{};const hasGrade=Number.isInteger(d.grade)&&d.grade>=0&&d.grade<=4&&q.accepted===true;const rejected=q.accepted===false;const grade=hasGrade?d.grade:null;const hasScore=hasGrade&&typeof d.score==='number'&&Number.isFinite(d.score)&&d.score>=0&&d.score<=1;
 $('report-ref').textContent=`Case: ${meta.caseRef}`;$('report-eye').textContent=meta.eye;$('report-time').textContent=meta.time;
 $('gradebadge').textContent=hasGrade?String(grade):'—';$('grade-title').textContent=hasGrade?`Grade ${grade} · ${grades[grade]}`:rejected?'Recapture required':'No grade available';
 $('grade-subtitle').textContent=hasGrade?'Automated prediction · pending clinician assessment':rejected?'Image did not pass the automated quality gate.':'Quality review only. No severity result was issued.';
 $('referral').textContent=hasGrade?(grade>=2?'Referable range':'Below referral cutoff'):'Not assessed';$('referral-detail').textContent=hasGrade?'Prototype rule: predicted grade ≥ 2':'A valid grade is needed to apply the screening rule.';
 $('score').textContent=hasScore?`${(d.score*100).toFixed(1)}%`:'Not available';$('quality-status').textContent=q.accepted===true?'Checks passed':rejected?'Recapture':'Not available';
 $('summary').textContent=hasGrade?`The model classified the submitted image as Grade ${grade} (${grades[grade]}). ${hasScore?`The top-class score was ${(d.score*100).toFixed(1)}%. `:''}${grade>=2?'This meets the prototype’s Grade 2+ screening flag for clinician assessment.':'This falls below the prototype’s Grade 2+ screening flag; clinical review is still required.'}`:rejected?'The quality gate rejected this image, so a severity grade and referral category are not issued. Review the quality observations below before repeating the capture.':'No valid severity prediction was returned. Check that a trained model is available, and review any processing details below.';
 $('interpretation').textContent=hasGrade?meaning[grade]:'An image without a valid grade cannot be interpreted as a negative screening result.';
 const guidance=hasGrade?careGuidance[grade]:noGradeGuidance;
 $('care-guidance-summary').textContent=hasGrade?`Grade ${grade} guidance is for follow-up planning only. It is not a diagnosis and does not select medicines.`:'No grade-based care guidance is available until an adequate image produces a valid result.';
 $('care-guidance-list').replaceChildren(...guidance.slice(1).map(item=>{const li=document.createElement('li');li.textContent=item;return li}));
 $('review-focus').textContent=hasGrade?'Inspect the original image, confirm image adequacy, and compare the predicted grade with the observed findings. Record any disagreement and clinician-directed follow-up below.':'Check focus, illumination and positioning; confirm that the retina is visible. Obtain an adequate fundus image before repeating the screening.';
 $('quality-feedback').textContent=q.feedback||'No quality feedback was returned.';
 qualityMetric(q.focus,'focus',v=>v.toExponential(2),v=>v>0.00003?'Above the experimental focus cutoff.':'At or below the experimental focus cutoff.');
 qualityMetric(q.brightness,'brightness',v=>`${(v*100).toFixed(1)}%`,v=>v>0.08&&v<0.92?'Inside the experimental brightness range.':'Outside the experimental brightness range.');
 qualityMetric(q.coverage,'coverage',v=>`${(v*100).toFixed(1)}%`,v=>v>0.25?'Above the experimental coverage cutoff.':'At or below the experimental coverage cutoff.');
 $('evidence-grid').replaceChildren(
 imageCard('Original image',originalUrl,'The uploaded image, preserved for visual comparison. Review this alongside the processed views.'),
 imageCard('Enhanced input',validImage(d.enhanced),'Contrast-enhanced and resized input used for classification. Enhancement may change the appearance of details.'),
 imageCard('Grad-CAM attention',hasGrade?validImage(d.heatmap):null,'Warmer colours indicate areas contributing to the selected class. Attention is not a lesion boundary or confirmation of disease.'),
 imageCard('Vessel candidates',validImage(d.vessels),'Experimental vessel-like structures from image filtering. This may include noise and does not confirm abnormal vessels.')
 );
 $('backend-note').textContent=d.note||'No additional backend message.';updateReview();$('empty').hidden=true;$('report').hidden=false;$('print').disabled=false;reportReady=true;
}
function validImage(value){return typeof value==='string'&&value.startsWith('data:image/png;base64,')?value:null}
function updateReview(){$('review-status').textContent=$('disposition').selectedIndex===0?'Awaiting review':'Review entered';$('printed-review').textContent=`Reviewer: ${$('reviewer-name').value.trim()||'Not specified'}\nStatus: ${$('disposition').value}\n\n${$('notes').value.trim()||'No reviewer observations entered.'}`}
$('disposition').onchange=updateReview;$('notes').oninput=updateReview;$('reviewer-name').oninput=updateReview;
$('run').onclick=async()=>{if(!file||busy||!patientSnapshot)return;const meta={caseRef:$('case-id').value.trim()||'Not specified',eye:$('eye').value,time:new Date().toLocaleString()};clearReport();setBusy(true);const start=Date.now();message('MATLAB is analysing the image. This can take several minutes.');const timer=setInterval(()=>message(`MATLAB is analysing the image · ${Math.floor((Date.now()-start)/1000)} seconds elapsed. Please keep this page open.`),1000);try{const r=await fetch('/api/screen',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});let d;try{d=await r.json()}catch{throw Error('The server returned an unreadable response. Check the PowerShell window.')}if(!r.ok)throw Error(d.error||'Analysis could not finish.');if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Unexpected analysis response.');clearInterval(timer);render(d,meta);message('');}catch(e){clearInterval(timer);message(e.message||'Could not reach the local server.',true);}finally{clearInterval(timer);setBusy(false)}};
$('print').onclick=()=>{if(reportReady){updateReview();window.print()}};
window.addEventListener('beforeprint',updateReview);
$('close-lightbox').onclick=()=>$('lightbox').close();

// Patient information is saved to the local SQLite database and is never sent to /api/screen.
function setStep(stage){for(const name of ['patient','image','review'])$('step-'+name).classList.toggle('active',name===stage)}
const localToday=new Date();$('last-exam').max=[localToday.getFullYear(),String(localToday.getMonth()+1).padStart(2,'0'),String(localToday.getDate()).padStart(2,'0')].join('-');
function patientData(){return {
 name:$('patient-name').value.trim(),reference:$('patient-ref').value.trim(),age:$('patient-age').value,
 gender:$('patient-gender').value,phone:$('patient-phone').value.trim(),eye:$('patient-eye').value,
 diabetes:$('diabetes-type').value,duration:$('diabetes-years').value,hypertension:$('hypertension').value,
 priorDR:$('prior-dr').value,lastExam:$('last-exam').value,treatment:$('previous-treatment').value,
 symptoms:$('symptoms').value,history:$('history-notes').value.trim(),consent:$('consent').checked
}}
$('patient-form').onsubmit=async e=>{e.preventDefault();if(busy)return;if(!$('patient-form').reportValidity())return;const data=patientData();
 if(!data.name||!data.reference){$('intake-error').textContent='Enter a patient name or alias and a case reference.';return}
 if(data.duration!==''&&Number(data.duration)>Number(data.age)){$('intake-error').textContent='Years since diagnosis cannot exceed the patient age.';return}
 if(data.diabetes==='No known diabetes'&&data.duration!==''){$('intake-error').textContent='Clear years since diagnosis when no diabetes is known.';return}
 if(!data.consent){$('intake-error').textContent='Confirm consent or authorised demonstration use before continuing.';return}
 $('intake-error').textContent='';
 try{
  const response=await fetch('/api/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   patientId:data.reference,name:data.name,age:data.age,contact:data.phone,diabetes:data.diabetes,
   diabetesYears:data.duration,gender:data.gender,hypertension:data.hypertension,priorDR:data.priorDR,
   lastExam:data.lastExam,treatment:data.treatment,symptoms:data.symptoms,history:data.history,
   eye:data.eye,consent:data.consent
  })});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Patient details could not be saved locally.');
 }catch(error){$('intake-error').textContent=error.message||'Patient details could not be saved locally.';return}
 patientSnapshot=Object.freeze({...data});$('case-id').value=data.reference;$('eye').value=data.eye;
 $('patient-strip-name').textContent=data.name;$('patient-strip-details').textContent=`${data.reference} · ${data.age} years · ${data.eye} · ${data.diabetes}`;
 $('patient-initials').textContent=data.name.split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 $('intake').hidden=true;$('patient-strip').hidden=false;$('screening-layout').hidden=false;setStep('image');$('run').disabled=!file;
 $('patient-strip').scrollIntoView({behavior:'smooth',block:'start'});
};
$('edit-patient').onclick=()=>{if(busy)return;clearReport();message('');patientSnapshot=null;$('run').disabled=true;$('screening-layout').hidden=true;$('patient-strip').hidden=true;$('intake').hidden=false;setStep('patient');$('intake').scrollIntoView({behavior:'smooth',block:'start'})};
$('new-patient').onclick=()=>{if(!busy)$('new-patient-dialog').showModal()};
$('cancel-new').onclick=()=>$('new-patient-dialog').close();
$('confirm-new').onclick=()=>{if(busy)return;$('new-patient-dialog').close();patientSnapshot=null;$('patient-form').reset();$('file').value='';selectFile(null);$('patient-report-grid').replaceChildren();$('patient-report-notes').textContent='';$('case-id').value='';$('eye').selectedIndex=0;$('intake-error').textContent='';$('screening-layout').hidden=true;$('patient-strip').hidden=true;$('intake').hidden=false;setStep('patient');$('patient-name').focus()};
function renderPatient(){const d=patientSnapshot;if(!d)return;const values=[
 ['Patient / alias',d.name],['Case reference',d.reference],['Age',d.age+' years'],['Gender',d.gender],['Contact',d.phone||'Not provided'],['Eye',d.eye],
 ['Diabetes status',d.diabetes],['Since diagnosis',d.duration!==''?d.duration+' years':'Unknown'],['High blood pressure',d.hypertension],
 ['Previous DR diagnosis',d.priorDR],['Last eye exam',d.lastExam||'Unknown'],['Previous treatment',d.treatment],['Visual symptoms',d.symptoms]
 ];$('patient-report-grid').replaceChildren();for(const [label,value]of values){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);$('patient-report-grid').append(item)}
 $('patient-report-notes').textContent=d.history?'Additional reported history: '+d.history:'No additional history entered.';
}
