// HANOK 플래너 연동 (Google Apps Script 웹 앱)
// - 비서실장이 Drive '플래너 연동' 폴더에 올린 CEO일정-YYYY-MM-DD.json 을 플래너 앱에 전달합니다.
// - 플래너 앱의 체크·메모를 같은 폴더의 플래너체크-YYYY-MM-DD.json 에 기록합니다.
// 설정: 프로젝트 설정 > 스크립트 속성에 TOKEN(연동 비밀번호) 추가. 아래 FOLDER_ID는 그대로 둡니다.

const FOLDER_ID = '1Zlb0FrFgQ8s0PJTRmTgtE4WS6eQjc9dg'; // HANOK 비서실장 > 플래너 연동

function token_() { return PropertiesService.getScriptProperties().getProperty('TOKEN'); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
function folder_() { return DriveApp.getFolderById(FOLDER_ID); }

function latest_(name) {
  const it = folder_().getFilesByName(name);
  let best = null;
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    if (!best || f.getDateCreated() > best.getDateCreated()) best = f;
  }
  return best;
}
function readJson_(name) {
  const f = latest_(name);
  if (!f) return null;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}
function authed_(t) { const k = token_(); return !!k && t === k; }

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!authed_(p.token)) return out_({ ok: false, error: 'unauthorized' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today_();
  const plan = readJson_('CEO일정-' + date + '.json');
  const checks = readJson_('플래너체크-' + date + '.json');
  return out_({ ok: true, date: date, plan: plan, checks: (checks && checks.items) || {} });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad_json' }); }
  if (!authed_(b.token)) return out_({ ok: false, error: 'unauthorized' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !/^[A-Za-z0-9_-]{1,24}$/.test(b.id || '')) return out_({ ok: false, error: 'bad_input' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const name = '플래너체크-' + b.date + '.json';
    const f = latest_(name);
    let data = { date: b.date, items: {} };
    if (f) { try { data = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (x) {} }
    data.items = data.items || {};
    const it = data.items[b.id] || {};
    const now = new Date().toISOString();
    if (typeof b.done === 'boolean') { it.done = b.done; it.doneAt = b.done ? now : null; }
    if (typeof b.note === 'string') { it.note = b.note.slice(0, 500); it.noteAt = now; }
    data.items[b.id] = it;
    data.updatedAt = now;
    const json = JSON.stringify(data, null, 1);
    if (f) f.setContent(json); else folder_().createFile(name, json, MimeType.PLAIN_TEXT);
    return out_({ ok: true, item: it });
  } finally {
    lock.releaseLock();
  }
}

// 배포 전 한 번 실행해서 Drive 권한을 승인하세요.
function setupCheck() {
  Logger.log('폴더: ' + folder_().getName());
  Logger.log('TOKEN 설정됨: ' + !!token_());
}
