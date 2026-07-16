import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Remove storage imports
js = js.replace("import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';\n", "")
js = js.replace("const storage = getStorage(app);\n", "")

# 2. Replace the background storage block
old_block = """// --- CUSTOM BACKGROUND STORAGE (Firebase) ---
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
}"""

new_block = """// --- CUSTOM BACKGROUND STORAGE (Firestore Base64) ---
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Calculate new dimensions (max 2048px to keep it under 1MB)
                const MAX_DIMENSION = 2048;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}

async function saveCustomBackground(villageId, file) {
    const base64Url = await compressImageToBase64(file);
    await setDoc(doc(db, "village_settings", villageId), {
        customBackgroundUrl: base64Url
    }, { merge: true });
    return base64Url;
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
}"""

if old_block in js:
    js = js.replace(old_block, new_block)
else:
    print("WARNING: Could not find old block to replace!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Migration to Base64 executed!")
