# RetinaBridge — local setup guide

A local MATLAB + Python + browser prototype for SIH problem 26038: Explainable AI for Diabetic Retinopathy Screening in Rural India.

## 1. What you received

- `web/`: responsive screening website; upload, preview, processing feedback, result images, reviewer notes and print-to-PDF.
- `server.py`: local Python web server; sends images to MATLAB through `matlab -batch`. No paid AI API or MATLAB Engine Python package is needed. Browser HTTP endpoints are still used to communicate with your own backend.
- `matlab/`: preprocessing/quality checks, ResNet-18 transfer training, five-class inference, real model Grad-CAM, evaluation, and a Simulink model builder.
- `check_dataset.py`: identifies missing, corrupted and Git LFS pointer images.

This is a runnable prototype implementation, NOT a trained or clinically validated SIH submission. MATLAB execution could not be tested in the build environment because MATLAB is unavailable. No model weights or accuracy claims are included. Python HTTP/upload checks and JavaScript syntax were tested separately; see TEST_RESULTS.md.

## 2. Keep your dataset where it is

Your privately obtained dataset should have this layout:

```text
<dataset-root>\train.csv
<dataset-root>\train_images\<id_code>.png
```

Extract RetinaBridge into Downloads as its own folder. Do not overwrite your dataset. If your actual data has a different layout, point the commands below at the folder containing train.csv and train_images.

The uploaded ZIP contains Git LFS pointer text in the .png files. A 131-byte PNG is a pointer, not a retinal photo. Check images on your laptop too. Open one in Photos: it should display a fundus photograph.

If your folder is a real Git clone, `git lfs install` then `git lfs pull` inside that repository may restore the images, provided the remote has the objects and you have access. A downloaded source ZIP is not a Git clone, so those commands alone will not repair it. Alternatively download APTOS from Kaggle, accept its access conditions, extract the actual train_images and train.csv into aptos2019. Do not use sample_submission.csv as ground truth; APTOS test.csv does not provide training labels.

## 3. Start the website first

Install Python and a licensed desktop MATLAB. In PowerShell:

```powershell
cd "D:\path\to\RetinaBridge"
python -m pip install -r requirements.txt
python check_dataset.py "D:\path\to\dataset-root"
python server.py
```

Open http://127.0.0.1:5000 in Chrome. Keep PowerShell open. Ctrl+C stops it. Subsequent launches can use START_WINDOWS.bat.

If MATLAB is not found, in MATLAB run `matlabroot`, then use the corresponding executable in PowerShell before starting the server. Example only—replace the release with yours:

```powershell
$env:MATLAB_EXE = "C:\Program Files\MATLAB\<release>\bin\matlab.exe"
python server.py
```

You do not need Node, React, a database, MATLAB Engine, or a cloud service. This version intentionally runs beside your local MATLAB installation. A hosted website cannot directly access your Windows C: drive or run desktop MATLAB.

## 4. Train your model in MATLAB

Required: Image Processing Toolbox, Deep Learning Toolbox and the ResNet-18 pretrained model support package. Simulink is needed only for workflow simulation. Check your university license and use MATLAB Add-On Explorer for missing packages. The code uses the SeriesNetwork/trainNetwork APIs; check compatibility with your installed MATLAB release.

In MATLAB's Command Window:

```matlab
cd('D:\path\to\RetinaBridge\matlab')
train_dr('D:\path\to\dataset-root', 12)
evaluate_dr
```

Training may take hours depending on hardware. Reduce MiniBatchSize from 16 to 8 or 4 in train_dr.m if GPU memory runs out. Two epochs can check the workflow, but are not a performance result.

Training saves `models/dr_model.mat`. The website finds it automatically on the next analysis. Evaluation writes `models/evaluation.json` and held-out predictions. Reload the page to refresh model status.

The model uses a reproducible 70/15/15 image-stratified split and inverse-frequency class weights. Train and inference share preprocessing. Hold out the test partition; don't tune against it. Patient IDs are not supplied in APTOS metadata, so patient-disjoint testing is NOT guaranteed. Duplicate images and patient overlap need additional audit before publication.

## 5. Run a screening

1. Choose a real fundus PNG/JPG (under 15 MB; at least 224×224).
2. Click Assess & screen. MATLAB starts in batch mode; startup adds latency.
3. Poor quality receives recapture feedback and no grade. Without weights, only quality checks and image processing are returned.
4. With a model, an accepted image receives a predicted grade 0–4, an uncalibrated model score and Grad-CAM when supported.
5. A clinician reviews the original image and evidence, adds notes and prints/saves a PDF through the browser.

The quality thresholds are experimental, not a validated quality classifier. A non-fundus photo may pass them. Field-of-view checks use nonblack coverage only. The heuristic vessel mask is labeled as candidates; it is not lesion evidence. No score should be interpreted as calibrated disease probability.

All images are processed locally. The application does not retain patient records. Temporary files are deleted after a request; manually saved PDF reports remain wherever you save them. The server binds only to 127.0.0.1 and is for local development. Before shared deployment, design authentication, authorization, consent, audit, retention, encryption and the MATLAB hosting/licensing arrangement.

## 6. Simulink

In the same MATLAB folder:

```matlab
build_workflow
sim('DR_telemedicine')
```

This creates `models/DR_telemedicine.slx`. Baseline: 400 arrivals/day × 250 operating days = 100,000 patients; effective capacity is min(upload 480, processing 600, review 360) patients/day, producing a 10,000-patient end-of-period backlog. Edit capacity and inspect the Queue scope. This fluid approximation assumes all patients get reviewed, constant operating-day rates and no abandonments or rework. It is not a completed discrete-event telemedicine simulator.

To relate bandwidth to upload capacity, compute available megabits/second × 3600 × operating hours / (8 × image size in megabytes). Deduct downtime and retransmissions. Reviewer capacity is reviewers × operating hours × 3600 / seconds per review. Use observed timings, including MATLAB startup in this version, not guessed throughput.

## 7. What remains for the SIH requirements

| Requirement | Delivered | Required next work |
|---|---|---|
| Quality assessment/enhancement | Focus, brightness, nonblack coverage, CLAHE and smoothing | Calibrate on labeled acceptable/borderline/rejected images; test camera domains; enhance borderline only and re-assess |
| Anatomy and lesion segmentation | Heuristic vessel candidates only | Train/evaluate DRIVE vessel segmentation and IDRiD lesion segmentation; optic disc/fovea localization; separate hemorrhage and neovascularization evidence |
| DR 0–4 | ResNet-18 transfer-training and inference code | Restore data, train, audit splits, compare architectures; assess high-resolution/patch strategy |
| >90% sensitivity, >85% specificity | Held-out evaluation with Wilson 95% intervals | Demonstrate targets on independent cohorts; assess rejection coverage and end-to-end performance |
| Explainability | Grad-CAM overlay and reviewer notes | Lesion-grounded evidence, expert usefulness study and timed review; Grad-CAM alone is insufficient |
| Calibrated confidence | Uncalibrated score explicitly labeled | Fit temperature scaling on validation data, report ECE/Brier/reliability on untouched test data |
| Simulink | Constant-rate bottleneck/backlog model builder | Stochastic arrivals, upload outages, rejection/recapture loops, referral fraction and resource sweep |
| Benchmark superiority | No claimed result | Pre-register baseline comparisons and paired uncertainty analysis on the same test cohort |

Resizing to 224×224 can erase tiny lesions. It is a baseline, not a sub-pixel microaneurysm detector. A lesion smaller than the information captured by the camera cannot be established reliably just by upscaling. Retain originals and develop high-resolution patches with lesion annotations. APTOS image grades alone cannot supervise pixel-level lesion segmentation.

Suggested order: restore images → run baseline → freeze test set → evaluate → add validated quality model → add supervised lesion/anatomical models → calibrate → external validation → clinician review study → measured workflow simulation. Report failures and rejected-image rates as well as successful predictions.

## 8. Explain it to your full-stack teammate

“The browser uploads an image to our own Python backend. Python writes a temporary PNG, starts our local MATLAB function, reads its JSON result and annotated images, and returns them to the website. MATLAB owns preprocessing, classification and explanation. The frontend displays results and collects review notes. We are not calling an external AI provider.”

The backend passes paths through environment variables and uses subprocess arguments without a shell. Each request starts MATLAB; a persistent Engine worker would reduce latency in a future version, but is not included here.

## Sources and dataset entry points

- MATLAB batch execution: https://www.mathworks.com/help/matlab/ref/matlabwindows.html
- Grad-CAM documentation: https://www.mathworks.com/help/deeplearning/ref/gradcam.html
- APTOS (from supplied statement): https://www.kaggle.com/c/aptos2019-blindness-detection
- IDRiD (from supplied statement): https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid
- DRIVE (from supplied statement): https://drive.grand-challenge.org/
- Messidor-2 (from supplied statement): https://www.adcis.net/en/third-party/messidor2/

The requested targets and clinical requirements above come from your supplied SIH statement. Dataset entry points are provided for access; no datasets or licenses have been downloaded on your behalf.
