function train_dr(dataRoot,epochs)
% dataRoot = ...\data\raw\aptos2019 ; requires actual train_images and train.csv.
% Uses legacy SeriesNetwork API for compatibility with classify / gradCAM.
if nargin<2, epochs=12; end
root=fileparts(fileparts(mfilename('fullpath'))); rng(42);
T=readtable(fullfile(dataRoot,'train.csv'),'TextType','string');
assert(all(ismember(["id_code","diagnosis"],string(T.Properties.VariableNames))),'CSV needs id_code and diagnosis columns.');
files=fullfile(dataRoot,'train_images',T.id_code+'.png');
assert(all(ismember(T.diagnosis,0:4)),'Grades must be integers 0..4.');
for i=1:numel(files)
    assert(isfile(files(i)),'Missing image: %s',files(i));
    f=fopen(files(i),'r'); sig=char(fread(f,80,'uint8')'); fclose(f);
    assert(~contains(sig,'git-lfs.github.com'),'LFS pointer found. Download actual dataset images first: %s',files(i));
end
Y=categorical(T.diagnosis,0:4,{'0','1','2','3','4'});
ds=imageDatastore(cellstr(files)); ds.Labels=Y; ds.ReadFcn=@readImage;
% APTOS split is image-stratified, not patient-disjoint (no patient IDs supplied).
[tr,rest]=splitEachLabel(ds,0.70,'randomized'); [va,te]=splitEachLabel(rest,0.5,'randomized');
assert(all(countcats(tr.Labels)>0) && all(countcats(va.Labels)>0) && all(countcats(te.Labels)>0),'Each split needs all five classes.');
base=resnet18; lg=layerGraph(base);
lg=replaceLayer(lg,'fc1000',fullyConnectedLayer(5,'Name','dr_fc','WeightLearnRateFactor',10,'BiasLearnRateFactor',10));
classes=categorical({'0','1','2','3','4'}); counts=countcats(tr.Labels); weights=sum(counts)./(5*counts);
lg=replaceLayer(lg,'ClassificationLayer_predictions',classificationLayer('Name','dr_output','Classes',classes,'ClassWeights',weights'));
aug=imageDataAugmenter('RandXReflection',true,'RandRotation',[-15 15]);
train=augmentedImageDatastore([224 224],tr,'DataAugmentation',aug);
opts=trainingOptions('adam','InitialLearnRate',1e-4,'MiniBatchSize',16,'MaxEpochs',epochs,'Shuffle','every-epoch','ValidationData',va,'Verbose',true,'Plots','training-progress');
net=trainNetwork(train,lg,opts);
trainFiles=tr.Files; valFiles=va.Files; testFiles=te.Files; testLabels=te.Labels;
if ~isfolder(fullfile(root,'models')), mkdir(fullfile(root,'models')); end
save(fullfile(root,'models','dr_model.mat'),'net','trainFiles','valFiles','testFiles','testLabels','-v7.3');
fprintf('Model saved. Run evaluate_dr. Do not tune on the held-out test set.\n');
end
function J=readImage(f)
[J,~]=preprocess_fundus(imread(f));
end
