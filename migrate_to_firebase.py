import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Update imports
if "getStorage" not in js:
    js = js.replace(
        "import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';",
        "import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';"
    )
    js = js.replace(
        "import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';",
        "import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';\nimport { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';"
    )

# 2. Initialize Storage
if "const storage = getStorage(app);" not in js:
    js = js.replace(
        "const db = getFirestore(app);",
        "const db = getFirestore(app);\nconst storage = getStorage(app);"
    )

# 3. Replace the old IDB functions and event listeners
# First, remove the old IDB logic chunk.
idb_chunk = re.search(r'// --- CUSTOM BACKGROUND STORAGE \(IndexedDB\) ---.*?function openDB\(\).*?async function saveCustomBackground.*?async function clearCustomBackground.*?}', js, flags=re.DOTALL)
if idb_chunk:
    js = js.replace(idb_chunk.group(0), "")

# Then, remove the old event listeners for bgUploadInput
listeners_chunk = re.search(r'const bgUploadInput.*?btnResetBg\.disabled = true;.*?if \(map && map\.getSource\(\'baskhedi-image\'\)\) \{.*?map\.getSource\(\'baskhedi-image\'\)\.updateImage\(\{ url: villageConfig\[currentVillageId\]\.imageOverlayUrl \}\);.*?}.*?}\n', js, flags=re.DOTALL)
if listeners_chunk:
    js = js.replace(listeners_chunk.group(0), "")

# 4. Insert the new Firebase Storage logic before startup()
new_logic = """
// --- CUSTOM BACKGROUND STORAGE (Firebase) ---
async function saveCustomBackground(villageId, file) {
    const storageRef = ref(storage, `backgrounds/${villageId}_bg.jpg`);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    await setDoc(doc(db, "village_settings", villageId), {
        customBackgroundUrl: downloadUrl
    }, { merge: true });
    return downloadUrl;
}

async function getCustomBackground(villageId) {
    const docRef = doc(db, "village_settings", villageId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().customBackgroundUrl) {
        return docSnap.data().customBackgroundUrl;
    }
    return null;
}

async function clearCustomBackground(villageId) {
    const docRef = doc(db, "village_settings", villageId);
    await setDoc(docRef, { customBackgroundUrl: null }, { merge: true });
    try {
        const storageRef = ref(storage, `backgrounds/${villageId}_bg.jpg`);
        await deleteObject(storageRef);
    } catch (e) {
        console.warn("Could not delete from storage, might already be deleted", e);
    }
}

const bgUploadInput = document.getElementById('bg-upload-input');
const btnResetBg = document.getElementById('btn-reset-bg');

if (bgUploadInput) {
  bgUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      bgUploadInput.disabled = true; // prevent multiple clicks
      try {
        const url = await saveCustomBackground(currentVillageId, file);
        window.customBgUrl = url;
        if (map && map.getSource('baskhedi-image')) {
           map.getSource('baskhedi-image').updateImage({ url: url });
        }
        if (btnResetBg) btnResetBg.disabled = false;
      } catch (e) {
        console.error("Error saving background", e);
        alert("Failed to upload background. Make sure you are logged in.");
      } finally {
        bgUploadInput.disabled = false;
      }
    }
  });
}

if (btnResetBg) {
  btnResetBg.addEventListener('click', async () => {
    btnResetBg.disabled = true;
    try {
      await clearCustomBackground(currentVillageId);
      window.customBgUrl = null;
      bgUploadInput.value = '';
      if (map && map.getSource('baskhedi-image')) {
         map.getSource('baskhedi-image').updateImage({ url: villageConfig[currentVillageId].imageOverlayUrl });
      }
    } catch (e) {
      console.error("Error clearing background", e);
      btnResetBg.disabled = false; // re-enable if failed
    }
  });
}
"""

js = js.replace("// Start app after all declarations are hoisted and initialized", new_logic + "\n// Start app after all declarations are hoisted and initialized")

# 5. Fix startup()
# Old startup was using URL.createObjectURL(blob).
# New startup just gets the URL directly.
old_startup = """async function startup() {
  try {
    const blob = await getCustomBackground(currentVillageId);
    if (blob) {
      window.customBgUrl = URL.createObjectURL(blob);
      if (document.getElementById('btn-reset-bg')) {
        document.getElementById('btn-reset-bg').disabled = false;
      }
    }
  } catch (e) {
    console.error("Error loading custom background", e);
  }
  initTokenState();
}"""

new_startup = """async function startup() {
  try {
    const url = await getCustomBackground(currentVillageId);
    if (url) {
      window.customBgUrl = url;
      if (document.getElementById('btn-reset-bg')) {
        document.getElementById('btn-reset-bg').disabled = false;
      }
    }
  } catch (e) {
    console.error("Error loading custom background", e);
  }
  initTokenState();
}"""

js = js.replace(old_startup, new_startup)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Migration script executed!")
