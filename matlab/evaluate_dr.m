function M=evaluate_dr
root=fileparts(fileparts(mfilename('fullpath'))); S=load(fullfile(root,'models','dr_model.mat'));
D=imageDatastore(S.testFiles); D.ReadFcn=@readImage;
[p,scores]=classify(S.net,D); truth=str2double(string(S.testLabels)); pred=str2double(string(p));
a=truth>=2; b=pred>=2; tp=sum(a&b); tn=sum(~a&~b); fp=sum(~a&b); fn=sum(a&~b);
M=struct('n',numel(a),'accuracy',mean(truth==pred),'sensitivity',tp/max(1,tp+fn),'specificity',tn/max(1,tn+fp),'TP',tp,'TN',tn,'FP',fp,'FN',fn);
M.sensitivityCI95=wilson(tp,tp+fn); M.specificityCI95=wilson(tn,tn+fp);
M.targetsMet=M.sensitivity>0.90 && M.specificity>0.85;
M.note='Image-level internal test only; patient overlap cannot be excluded. No external or clinical validation. Quality rejection is not included in these classifier-only metrics.';
M.confusion=confusionmat(truth,pred,'Order',0:4);
f=fopen(fullfile(root,'models','evaluation.json'),'w'); fprintf(f,'%s',jsonencode(M)); fclose(f); disp(M);
save(fullfile(root,'models','test_predictions.mat'),'truth','pred','scores');
end
function J=readImage(f), [J,~]=preprocess_fundus(imread(f)); end
function ci=wilson(k,n)
if n==0,ci=[NaN NaN];return;end
z=1.96;p=k/n;den=1+z*z/n;center=(p+z*z/(2*n))/den;half=z*sqrt(p*(1-p)/n+z*z/(4*n*n))/den;ci=[center-half center+half];
end
