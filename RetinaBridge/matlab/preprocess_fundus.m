function [J,q] = preprocess_fundus(I)
% Fixed preprocessing for training and inference. Quality thresholds are experimental.
if size(I,3)==1, I=repmat(I,1,1,3); end
I=im2uint8(I(:,:,1:3)); g=im2single(rgb2gray(I)); mask=g>0.04;
q.coverage=mean(mask(:));
if any(mask(:)), q.brightness=mean(g(mask)); else, q.brightness=0; end
L=imfilter(g,fspecial('laplacian',0.2),'replicate'); q.focus=var(L(mask));
if isnan(q.focus), q.focus=0; end
q.accepted=q.coverage>0.25 && q.brightness>0.08 && q.brightness<0.92 && q.focus>0.00003;
q.feedback='Heuristic quality checks passed. A reviewer must confirm fundus identity and field of view.';
if ~q.accepted, q.feedback='Recapture: check focus, lighting and retinal coverage. No DR grade is issued.'; end
% Keep the full field. Resize consistently; do not claim micro-lesion resolution.
J=imresize(I,[224 224]); lab=rgb2lab(J); light=lab(:,:,1)/100;
light=adapthisteq(light,'ClipLimit',0.01); lab(:,:,1)=100*imgaussfilt(light,0.4);
J=im2uint8(lab2rgb(lab));
end
