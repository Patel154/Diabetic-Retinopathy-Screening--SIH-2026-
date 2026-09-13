function screen_image
job=getenv('DR_JOB_DIR'); root=getenv('DR_PROJECT_DIR');
I=imread(fullfile(job,'input.png')); [J,q]=preprocess_fundus(I);
r=struct('status','Quality assessment only','quality',q,'grade',[], 'label','','score',[], 'note','Research prototype. Clinical validation is pending.');
imwrite(J,fullfile(job,'enhanced.png'));
% These are vessel-like candidates, not validated anatomical segmentation.
g=im2single(J(:,:,2)); v=imbothat(g,strel('disk',5,0));
v=imbinarize(v,'adaptive','Sensitivity',0.55) & g>0.06;
imwrite(v,fullfile(job,'vessels.png'));
model=fullfile(root,'models','dr_model.mat');
if ~q.accepted
    r.status='Image rejected — recapture required';
elseif ~isfile(model)
    r.note='No trained model found. Run train_dr in MATLAB. No severity or confidence has been invented.';
else
    S=load(model,'net'); [label,scores]=classify(S.net,J);
    r.grade=str2double(string(label)); names={'No DR','Mild','Moderate','Severe','Proliferative'};
    r.label=names{r.grade+1}; r.score=double(max(scores)); r.status='Awaiting clinician review';
    r.note='Unvalidated model output. Grad-CAM shows model attention, not proven lesion evidence.';
    try
        map=gradCAM(S.net,J,label); map=imresize(rescale(map),[224 224]);
        colors=ind2rgb(uint8(map*255),jet(256)); overlay=.6*im2double(J)+.4*colors;
        imwrite(overlay,fullfile(job,'heatmap.png'));
    catch ME
        r.note=[r.note ' Grad-CAM unavailable: ' ME.message];
    end
end
% jsonencode represents empty arrays as []; explicitly use JSON null for missing grades.
s=jsonencode(r); s=strrep(s,'"grade":[]','"grade":null'); s=strrep(s,'"score":[]','"score":null');
f=fopen(fullfile(job,'result.json'),'w'); cleanup=onCleanup(@()fclose(f)); fprintf(f,'%s',s);
end
