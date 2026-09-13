import argparse,csv
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('folder',help='aptos2019 folder');a=p.parse_args();root=Path(a.folder)
counts={'valid':0,'missing':0,'lfs_pointer':0,'corrupt':0};grades={str(i):0 for i in range(5)}
with (root/'train.csv').open(newline='') as f:
 for row in csv.DictReader(f):
  if row['diagnosis'] not in grades:raise ValueError('Invalid diagnosis: '+row['diagnosis'])
  grades[row['diagnosis']]+=1;im=root/'train_images'/(row['id_code']+'.png')
  if not im.exists():counts['missing']+=1;continue
  with im.open('rb') as h:head=h.read(100)
  if b'git-lfs.github.com' in head:counts['lfs_pointer']+=1;continue
  try:
   with Image.open(im) as pic:pic.verify()
   counts['valid']+=1
  except Exception:counts['corrupt']+=1
print('Images:',counts);print('Grade counts:',grades)
raise SystemExit(0 if counts['valid'] and not sum(counts[k] for k in ['missing','lfs_pointer','corrupt']) else 1)
