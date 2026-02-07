const SHEET_RESIDENTS = 'Residents';
const SHEET_ADMINS = 'Admins';
const SHEET_SETTINGS = 'Settings';
const APP_TITLE = '住戶資料管理 (傳賀社區)';
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- API Entry Points ---

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // 縮短 lock 時間避免並發請求造成 timeout, 實際操作時間應該很短
  lock.tryLock(10000); 

  try {
    const params = e.parameter || {};
    const action = params.action;
    
    // Parse POST body if available
    let postData = {};
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        // Fallback for form-urlencoded or plain text
        postData = params; 
      }
    }

    // Merge parameters
    const data = { ...params, ...postData };
    const reqAction = data.action || action;

    let result = {};

    if (!reqAction) {
        // Default: return status check
        return createJSONOutput({ status: 'success', message: 'API is running' });
    }

    // Public endpoints
    if (reqAction === 'login') {
      result = login(data.username, data.password);
    } else if (reqAction === 'createResident') {
      // Allow public submission
      result = createResident(data, null);
    } else {
      // Protected endpoints
      const token = data.token;
      if (!isValidSession(token)) {
        return createJSONOutput({ status: 'error', message: 'Session expired or invalid. Please login again.' });
      }

      switch (reqAction) {
        case 'getAllResidents':
          result = getAllResidents(token);
          break;
        case 'searchResidents':
          result = searchResidents(data.query, token);
          break;
        case 'updateResident':
          result = updateResident(data, token);
          break;
        case 'deleteResident':
          result = deleteResident(data.unitNumber, token);
          break;
        case 'getAllAdmins':
          result = getAllAdmins(token);
          break;
        case 'createAdmin':
          result = createAdmin(data, token);
          break;
        case 'deleteAdmin':
          result = deleteAdmin(data.targetUsername, token);
          break;
        case 'updateAdminNotes':
          result = updateAdminNotes(data, token);
          break;
        case 'resetAdminPassword':
          result = resetAdminPassword(data, token);
          break;
        case 'changePassword':
          result = changePassword(data, token);
          break;
        case 'logout':
          result = logout(token);
          break;
        default:
          result = { status: 'error', message: 'Invalid action: ' + reqAction };
      }
    }

    return createJSONOutput(result);

  } catch (e) {
    return createJSONOutput({ status: 'error', message: 'Server Exception: ' + e.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- Helper Functions ---

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Auth & Session ---

function login(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ADMINS);
  
  if (!sheet) {
     sheet = ss.insertSheet(SHEET_ADMINS);
     sheet.appendRow(['Username', 'Password', 'LastLogin', 'Notes', 'Role']);
     sheet.appendRow(['admin', 'admin123', new Date(), 'Initial Admin', 'RW']);
  }
  
  const data = sheet.getDataRange().getValues();
  // Header: Username, Password, LastLogin, Notes, Role
  
  for (let i = 1; i < data.length; i++) {
    // Column 0: Username, Column 1: Password
    if (String(data[i][0]) === String(username)) {
      if (String(data[i][1]) === String(password)) { 
        const token = Utilities.getUuid();
        const expiry = new Date().getTime() + SESSION_TIMEOUT_MS;
        const role = data[i][4] || 'RW'; // Default to RW if missing
        
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty('SESSION_' + token, JSON.stringify({
          username: username,
          role: role,
          expiry: expiry
        }));
        
        // Update LastLogin
        sheet.getRange(i + 1, 3).setValue(new Date());
        
        return { status: 'success', token: token, username: username, role: role };
      }
    }
  }
  return { status: 'error', message: '帳號或密碼錯誤' };
}

function isValidSession(token) {
  if (!token) return false;
  const userProperties = PropertiesService.getUserProperties();
  const sessionJson = userProperties.getProperty('SESSION_' + token);
  
  if (!sessionJson) return false;
  
  try {
      const session = JSON.parse(sessionJson);
      if (new Date().getTime() > session.expiry) {
        userProperties.deleteProperty('SESSION_' + token);
        return false;
      }
      return true;
  } catch(e) {
      return false;
  }
}

function logout(token) {
    if(token) {
        PropertiesService.getUserProperties().deleteProperty('SESSION_' + token);
    }
    return { status: 'success' };
}

// --- Data Operations ---

function getAllResidents(token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RESIDENTS);
  if (!sheet) {
      initialSetup();
      sheet = ss.getSheetByName(SHEET_RESIDENTS);
  }
  
  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return { status: 'success', data: [] };
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = {};
    headers.forEach((h, idx) => {
      row[String(h).trim()] = data[i][idx];
    });
    result.push(row);
  }
  
  return { status: 'success', data: result };
}

function searchResidents(query, token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESIDENTS);
  if (!sheet) return { status: 'success', data: [] }; // No data yet

  const data = sheet.getDataRange().getValues();
  if(!data || data.length <=1) return { status: 'success', data: [] };

  const headers = data[0];
  const results = [];
  
  if (!query) return { status: 'success', data: [] }; // Empty query returns nothing or all? Usually nothing for search.

  const q = query.toString().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowStr = row.join(' ').toLowerCase();
    
    if (rowStr.includes(q)) {
      let item = {};
      headers.forEach((h, index) => {
        item[String(h).trim()] = row[index];
      });
      results.push(item);
    }
  }
  return { status: 'success', data: results };
}

function getCommunityPasscode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(['Key', 'Value', 'Description']);
    sheet.appendRow(['CommunityPasscode', '12345678', '住戶填寫資料驗證碼']);
    return '12345678';
  }
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'CommunityPasscode') {
      return String(data[i][1]).trim();
    }
  }
  
  // If key not found, append it
  sheet.appendRow(['CommunityPasscode', '12345678', '住戶填寫資料驗證碼']);
  return '12345678';
}

function createResident(data, token) {
  // 1. Verify Passcode
  const inputCode = String(data.passcode || '').trim();
  const validCode = getCommunityPasscode();
  
  if (inputCode !== validCode) {
      return { status: 'error', message: '社區驗證碼錯誤，請檢查您的輸入 (或洽詢管理員)。' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESIDENTS);
  
  // Make sure headers exist
  const headersRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  const headers = headersRange.getValues()[0];
  
  // New row data map
  const newRow = headers.map(h => {
     const key = String(h).trim();
     return data[key] !== undefined ? data[key] : '';
  });
  
  // Check for existing UnitNumber (Upsert Logic)
  const unitNumber = String(data.UnitNumber || '').trim();
  if (unitNumber) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
          // Get all unit numbers from Column A (Row 2 to LastRow)
          const units = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]).trim());
          const existingIndex = units.indexOf(unitNumber);
          
          if (existingIndex !== -1) {
              // Found! Update existing row. 
              // Row index = existingIndex + 2 (Header is row 1, data starts at row 2)
              sheet.getRange(existingIndex + 2, 1, 1, newRow.length).setValues([newRow]);
              return { status: 'success', message: '資料已更新 (戶號: ' + unitNumber + ')' };
          }
      }
  }
  
  sheet.appendRow(newRow);
  return { status: 'success', message: '資料已新增' };
}

function updateResident(data, token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESIDENTS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  // Find by UnitNumber (Assuming Column A)
  // Or better, find by original UnitNumber if we allow changing it (would need ID)
  // For now, assume UnitNumber is key.
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(data.UnitNumber)) {
       const currentRow = values[i];
       const updatedRow = headers.map((h, idx) => {
           const key = String(h).trim();
           return data[key] !== undefined ? data[key] : currentRow[idx];
       });
       
       sheet.getRange(i+1, 1, 1, updatedRow.length).setValues([updatedRow]);
       return { status: 'success', message: '資料已更新' };
    }
  }
  return { status: 'error', message: '找不到該住戶僅 (UnitNumber not found)' };
}

function deleteResident(unitNumber, token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESIDENTS);
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(unitNumber)) {
      sheet.deleteRow(i+1);
      return { status: 'success', message: '資料已刪除' };
    }
  }
  return { status: 'error', message: '刪除失敗：找不到該住戶' };
}

// --- Admin Management ---

function getAllAdmins(token) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   const data = sheet.getDataRange().getValues();
   const admins = [];
   for(let i=1; i<data.length; i++) {
     admins.push({ 
         username: data[i][0], 
         lastLogin: data[i][2], 
         notes: data[i][3],
         role: data[i][4] || 'RW'
     });
   }
   return { status: 'success', data: admins };
}

function createAdmin(data, token) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   const users = sheet.getDataRange().getValues();
   
   for(let i=1; i<users.length; i++) {
     if(users[i][0] == data.username) return { status: 'error', message: '使用者名稱已存在' };
   }
   
   sheet.appendRow([data.username, data.password, '', data.notes || '', data.role || 'RW']);
   return { status: 'success', message: '管理員已新增' };
}

function deleteAdmin(targetUsername, token) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   const users = sheet.getDataRange().getValues();
   
   // Self delete check could be here
   
   for(let i=1; i<users.length; i++) {
     if(users[i][0] == targetUsername) {
         sheet.deleteRow(i+1);
         return { status: 'success', message: '管理員已刪除' };
     }
   }
   return { status: 'error', message: '找不到該使用者' };
}

function updateAdminNotes(data, token) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   const users = sheet.getDataRange().getValues();
   
   for(let i=1; i<users.length; i++) {
       if(users[i][0] == data.targetUsername) {
           sheet.getRange(i+1, 4).setValue(data.notes);
           return { status: 'success', message: '備註已更新' };
       }
   }
   return { status: 'error', message: '找不到該使用者' };
}

function resetAdminPassword(data, token) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_ADMINS);
   const users = sheet.getDataRange().getValues();
   
   for(let i=1; i<users.length; i++) {
       if(users[i][0] == data.targetUsername) {
           sheet.getRange(i+1, 2).setValue(data.newPassword);
           return { status: 'success', message: '密碼已重置' };
       }
   }
   return { status: 'error', message: '找不到該使用者' };
}

function changePassword(data, token) {
    // Need to identify current user from token
    const userProperties = PropertiesService.getUserProperties();
    const sessionJson = userProperties.getProperty('SESSION_' + token);
    if (!sessionJson) return { status: 'error', message: 'Session Invalid' };
    
    const currentUser = JSON.parse(sessionJson).username;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_ADMINS);
    const users = sheet.getDataRange().getValues();
    
    for(let i=1; i<users.length; i++) {
        if(users[i][0] == currentUser) {
             if(String(users[i][1]) !== String(data.oldPassword)) {
                 return { status: 'error', message: '舊密碼不正確' };
             }
             sheet.getRange(i+1, 2).setValue(data.newPassword);
             return { status: 'success', message: '密碼修改成功' };
        }
    }
    return { status: 'error', message: '找不到使用者' };
}

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName(SHEET_RESIDENTS)) {
    const sheet = ss.insertSheet(SHEET_RESIDENTS);
    const headers = [
      'UnitNumber', 'ContactName', 'ContactPhone', 'IsRenter', 'OwnerName', 'OwnerPhone', 
      'CarSpot1_Num', 'CarSpot1_Plate1', 'CarSpot1_Plate2', 'CarSpot1_IsRented', 'CarSpot1_RenterUnit', 
      'CarSpot2_Num', 'CarSpot2_Plate1', 'CarSpot2_Plate2', 'CarSpot2_IsRented', 'CarSpot2_RenterUnit', 
      'MotoSpot1_Num', 'MotoSpot1_Plate', 'MotoSpot1_IsRented', 'MotoSpot1_RenterUnit', 
      'MotoSpot2_Num', 'MotoSpot2_Plate', 'MotoSpot2_IsRented', 'MotoSpot2_RenterUnit', 
      'MotoSpot3_Num', 'MotoSpot3_Plate', 'MotoSpot3_IsRented', 'MotoSpot3_RenterUnit', 
      'Memo'
    ];
    sheet.appendRow(headers);
  }
  
  // Settings Sheet
  if (!ss.getSheetByName(SHEET_SETTINGS)) {
      const sheet = ss.insertSheet(SHEET_SETTINGS);
      sheet.appendRow(['Key', 'Value', 'Description']);
      sheet.appendRow(['CommunityPasscode', '12345678', '住戶填寫資料驗證碼']);
  }
}
