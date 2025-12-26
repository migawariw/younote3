/* ---------- Firebase ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, getDoc,
  setDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- Firebase 設定 ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCdDf0GH80PoGlcbk2yjlaVQfP01Gk9m18",
  authDomain: "noteeditor-ba1db.firebaseapp.com",
  projectId: "noteeditor-ba1db",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- DOM ---------- */
const views = {
  login: document.getElementById('view-login'),
  list: document.getElementById('view-list'),
  editor: document.getElementById('view-editor')
};
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const memoList = document.getElementById('memo-list');
const editor = document.getElementById('editor');
const titleInput = document.getElementById('title');
const userIcon = document.getElementById('user-icon');
const toast = document.getElementById('toast');

/* ---------- Toast ---------- */
function showToast(msg, duration=2000){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),duration);
}

/* ---------- View ---------- */
function show(view){
  Object.values(views).forEach(v=>v.hidden=true);
  views[view].hidden=false;
}

/* ---------- Navigation ---------- */
function navigateTo(view, memoId=null){
  if(view==='editor'){
    location.hash = `#/editor/${memoId}`;
    openEditor(memoId,false);
  } else if(view==='list'){
    location.hash = '#/list';
    show('list');
  } else {
    location.hash = '#/';
    show('login');
  }
}

/* ---------- Hash change ---------- */
window.addEventListener('hashchange', ()=>{
  const hash = location.hash;
  if(hash.startsWith('#/editor/')){
    const id = hash.split('/')[2]; 
    openEditor(id,false);
  } else if(hash === '#/list'){
    loadMemos();
    show('list');
  } else {
    show('login');
  }
});

/* ---------- Page load ---------- */
window.addEventListener('load', ()=>{
  if(location.hash) window.dispatchEvent(new Event('hashchange'));
});

/* ---------- Auth ---------- */
document.getElementById('login').onclick = ()=> signInWithEmailAndPassword(auth,emailInput.value,passwordInput.value);
document.getElementById('signup').onclick = ()=> createUserWithEmailAndPassword(auth,emailInput.value,passwordInput.value);

const provider = new GoogleAuthProvider();
document.getElementById('google-login').onclick = async()=>{ 
  try{ await signInWithPopup(auth,provider);} 
  catch(e){ alert("エラー\n"+e.code);}
}

// アイコンでアカウント切り替え
userIcon.onclick = async()=>{ 
  try{ await signInWithPopup(auth,provider);} 
  catch(e){ alert("アカウント切替失敗\n"+e.code);}
}

/* ---------- State ---------- */
let currentMemoId = null;

/* ---------- Auth state ---------- */
onAuthStateChanged(auth,user=>{
  if(user){
    if(user.photoURL) userIcon.src=user.photoURL;
    if(location.hash.startsWith('#/editor/')){
      const id = location.hash.split('/')[2]; openEditor(id);
    } else navigateTo('list');
  } else navigateTo('login');
});

/* ---------- Load list ---------- */
async function loadMemos(){
  // 二重表示防止
  memoList.innerHTML='';

  const q = query(collection(db,'users',auth.currentUser.uid,'memos'), orderBy('updated','desc'));
  const snap = await getDocs(q);
  snap.forEach(d=>{
    const data=d.data();
    const li=document.createElement('li');

    // 右側に日付と削除ボタン
    const rightDiv=document.createElement('div'); rightDiv.className='memo-right';
    const dateSpan=document.createElement('span'); dateSpan.textContent=new Date(data.updated).toLocaleString();
    const delBtn=document.createElement('button'); delBtn.className='delete-btn'; delBtn.textContent='🗑';
    delBtn.onclick=async(e)=>{
      e.stopPropagation();
      await deleteDoc(doc(db,'users',auth.currentUser.uid,'memos',d.id));
      li.remove();
      showToast('メモを削除しました');
    }

    rightDiv.append(dateSpan,delBtn);
    li.textContent = data.title || 'Untitled';
    li.appendChild(rightDiv);
    li.onclick = ()=>navigateTo('editor',d.id);
    memoList.appendChild(li);
  });
}

/* ---------- New memo ---------- */
document.getElementById('new-memo').onclick = async()=>{
  const ref=await addDoc(collection(db,'users',auth.currentUser.uid,'memos'),{title:'',content:'',updated:Date.now()});
  navigateTo('editor',ref.id);
};

/* ---------- Open editor ---------- */
async function openEditor(id,pushState=true){
  currentMemoId=id;
  const ref=doc(db,'users',auth.currentUser.uid,'memos',id);
  const snap=await getDoc(ref);
  const data=snap.data();
  titleInput.value=data.title||'';
  editor.innerHTML=data.content||'';
  show('editor');
  if(pushState) location.hash=`#/editor/${id}`;
}

/* ---------- Back button ---------- */
document.getElementById('back').onclick = ()=>navigateTo('list');

/* ---------- Save ---------- */
async function saveMemo(){
  if(!currentMemoId) return;
  let title = titleInput.value.trim();
  if(!title) title = editor.innerText.split('\n')[0].trim()||'';
  await setDoc(doc(db,'users',auth.currentUser.uid,'memos',currentMemoId),{title,content:editor.innerHTML,updated:Date.now()},{merge:true});
}
editor.addEventListener('input',saveMemo);
titleInput.addEventListener('input',saveMemo);

/* ---------- Click outside to blur ---------- */
document.addEventListener('click',(e)=>{ if(!e.target.closest('#editor')&&!e.target.closest('#title')) document.activeElement.blur(); });

/* ---------- Paste & Link preview ---------- */
editor.addEventListener('paste', async(e)=>{
  e.preventDefault();
  const items = e.clipboardData.items;
  const range = document.getSelection().getRangeAt(0);
  for(const item of items){
    if(item.type.startsWith('image/')){
      const reader = new FileReader();
      reader.onload = ()=>{ const img=document.createElement('img'); img.src=reader.result; range.insertNode(img); range.collapse(false);}
      reader.readAsDataURL(item.getAsFile()); return;
    }
  }
  const text = e.clipboardData.getData('text/plain');
  const yt = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if(yt){
    const wrap=document.createElement('div'); wrap.className='video';
    const iframe=document.createElement('iframe'); iframe.src=`https://www.youtube-nocookie.com/embed/${yt[1]}?modestbranding=1&rel=0&playsinline=1`;
    iframe.allowFullscreen=true; wrap.appendChild(iframe); range.insertNode(wrap); range.collapse(false);
  } else {
    const urlRegex=/https?:\/\/\S+\.(?:png|jpg|jpeg|gif)/i;
    const m=text.match(urlRegex);
    if(m){ const img=document.createElement('img'); img.src=m[0]; range.insertNode(img); range.collapse(false); }
    else document.execCommand('insertText',false,text);
  }
});
