# RetinaBridge website update

## Install on your Windows laptop

1. Stop the website: press Ctrl+C in its PowerShell window.
2. Make a backup copy of your existing `RetinaBridge\web` folder.
3. Open this download's `web` folder. Copy its THREE files (`index.html`, `style.css`, `app.js`) into:

   C:\Users\omnso\Downloads\RetinaBridge-SIH-Starter\RetinaBridge\web

4. Replace the three existing files. Do not put another web folder inside web.
5. Restart from PowerShell:

   cd "C:\Users\omnso\Downloads\RetinaBridge-SIH-Starter\RetinaBridge"
   python server.py

6. Visit http://127.0.0.1:5000 and press Ctrl+F5 for a fresh page.

No training, model-file changes, MATLAB edits or new dependencies are needed. This update uses the existing /api/status and /api/screen responses. It is for the local application beside your MATLAB installation.

## What changed

- Responsive screening workspace with a clearer hierarchy and a dark blue/teal theme.
- Upload validation, drag/drop, original-image preview and elapsed processing time.
- Optional case reference and eye selection. These are browser-only metadata, not inputs to the model.
- Predicted grade, top-class uncalibrated score and rule-based referral category.
- Observation summaries generated from the returned grade and quality data. These are deterministic explanations, NOT a second AI diagnosis or lesion detector.
- Actual focus, brightness and coverage values returned by MATLAB, interpreted against the original prototype thresholds.
- Original, enhanced, Grad-CAM and heuristic vessel-candidate views with explanations and enlargement.
- Manual reviewer name/status/notes and a print/PDF layout that includes complete notes.
- Separate handling for quality rejection, absent model output, missing heatmaps and failed requests.

## Report

Complete a screening, optionally enter reviewer notes, then choose Print / Save PDF. In the browser's print dialog choose Save as PDF. Use A4 and disable browser headers/footers if desired. The report is designed to put assessment first and the evidence/reviewer section on the next page; long notes can extend it. The report always retains prototype and human-review context.

The image, metadata and notes are not saved in a database. Refreshing or closing the page loses them unless you print/save. Reviewer status is manually entered and is not an authenticated clinical signature. Original images remain visible in the browser after temporary server files are deleted.

## Interpretation safeguards

Grade labels are model predictions. Grade 2+ defines the existing prototype's referable category; it is not an individually prescribed treatment plan. The score is uncalibrated. No lesion counts, anatomical findings or medical history are invented. A missing/rejected grade is never displayed as Grade 0. The experiment's population accuracy is not used as patient confidence or asserted as the identity of the loaded model.

General eye-health information is attributed in the interface to the National Eye Institute:
https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy

## Verification

See TEST_RESULTS.md for browser checks. MATLAB/model execution is unchanged and cannot be verified in this environment. Browser tests use simulated responses solely for checking UI behaviour; no demo result or fake medical image is shipped in the application.
