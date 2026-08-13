"use client";

import { ChangeEvent, PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageRow, supabase } from "../lib/supabase";

type Screen = "onboarding" | "canvas" | "composer" | "preview" | "thankyou";
type Wish = MessageRow & { image?: string };
type SubmitState = "idle" | "submitting" | "success" | "error";

const mascot = "https://www.figma.com/api/mcp/asset/9d6370b4-96f3-48cd-a899-109e32e67725.png";
const thankMascot = "https://www.figma.com/api/mcp/asset/f649a3fd-1775-4b98-b98a-cbcdcaeb85ad.png";
const colors = { blue: "#DAEBF8", green: "#DBF5D2", yellow: "#FAE6AD", slate: "#97AFBB" } as const;

function canvasPosition(itemNumber: number) {
  const angle = itemNumber * 2.399963229728653;
  const radius = 90 + 105 * Math.sqrt(itemNumber);
  return {
    x: Math.round((300 + radius * Math.cos(angle)) * 100) / 100,
    y: Math.round((320 + radius * Math.sin(angle)) * 100) / 100,
    rotation: ((itemNumber * 7) % 15) - 7,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [imageFile, setImageFile] = useState<File>();
  const [imagePreview, setImagePreview] = useState<string>();
  const [cardStyle, setCardStyle] = useState<keyof typeof colors>("blue");
  const [detail, setDetail] = useState<Wish>();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStyle, setEditStyle] = useState<keyof typeof colors>("blue");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [camera, setCamera] = useState({ x: -55, y: -20, scale: .92 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ px: 0, py: 0, x: 0, y: 0 });
  const submissionId = useRef<string>();
  const submissionImagePath = useRef<string>();

  const validMessage = message.trim().length <= 1000 && (message.trim().length > 0 || !!imageFile);
  const validName = anonymous || (name.trim().length > 0 && name.trim().length <= 60);
  const valid = validMessage && validName;

  const draftWish = useMemo<Wish>(() => {
    const position = canvasPosition(wishes.length + 1);
    return ({
    id: submissionId.current ?? "preview",
    sender_name: anonymous ? "Ẩn danh" : name.trim(),
    content: message.trim() || null,
    image_path: null,
    image: imagePreview,
    card_type: imageFile ? (message.trim() ? "mixed" : "image") : "text",
    card_style: cardStyle,
    canvas_x: position.x,
    canvas_y: position.y,
    rotation: position.rotation,
    moderation_status: "approved",
    created_at: new Date().toISOString(),
  });
  }, [anonymous, name, message, imageFile, imagePreview, cardStyle, wishes.length]);

  useEffect(() => { void loadApprovedMessages(); }, []);

  async function loadApprovedMessages() {
    setLoadingMessages(true); setLoadError("");
    const { data, error } = await supabase.from("messages").select("*").eq("moderation_status", "approved").order("created_at", { ascending: true });
    if (error) { setLoadError("Không thể tải lời chúc lúc này. Hãy thử lại."); setLoadingMessages(false); return; }
    const hydrated = await Promise.all((data as MessageRow[]).map(async row => {
      if (!row.image_path) return row;
      const { data: signed } = await supabase.storage.from("message-images").createSignedUrl(row.image_path, 3600);
      return { ...row, image: signed?.signedUrl };
    }));
    setWishes(hydrated); setLoadingMessages(false);
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button,.wish-card")) return;
    dragStart.current = { px: e.clientX, py: e.clientY, x: camera.x, y: camera.y };
    setDragging(true); e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (dragging) setCamera(c => ({ ...c, x: dragStart.current.x + e.clientX - dragStart.current.px, y: dragStart.current.y + e.clientY - dragStart.current.py }));
  }
  function wheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setCamera(c => ({ ...c, scale: Math.min(1.45, Math.max(.55, c.scale * (e.deltaY > 0 ? .92 : 1.08))) }));
  }
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 10 * 1024 * 1024) {
      setSubmitError("Chỉ nhận JPEG, PNG hoặc WebP tối đa 10 MB."); return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setSubmitError("");
  }

  async function sendMessage() {
    if (!valid || submitState === "submitting") return;
    setSubmitState("submitting"); setSubmitError("");
    const id = submissionId.current ?? crypto.randomUUID(); submissionId.current = id;
    const ext = imageFile?.type === "image/png" ? "png" : imageFile?.type === "image/webp" ? "webp" : "jpg";
    if (imageFile && !submissionImagePath.current) {
      submissionImagePath.current = `${id}/${crypto.randomUUID()}.${ext}`;
    }
    const imagePath = imageFile ? submissionImagePath.current ?? null : null;
    const cardType = imageFile ? (message.trim() ? "mixed" : "image") : "text";
    const position = canvasPosition(wishes.length + 1);
    const payload = {
      id, sender_name: anonymous ? "Ẩn danh" : name.trim(), content: message.trim() || null,
      image_path: imagePath, card_type: cardType, card_style: cardStyle,
      canvas_x: position.x, canvas_y: position.y, rotation: position.rotation, moderation_status: "approved",
    };
    const { error: insertError } = await supabase.from("messages").insert(payload);
    if (insertError && insertError.code !== "23505") {
      setSubmitState("error"); setSubmitError("Chưa thể gửi lời chúc. Bản nháp vẫn được giữ lại."); return;
    }
    if (imageFile && imagePath) {
      const { error: uploadError } = await supabase.storage.from("message-images").upload(imagePath, imageFile, { upsert: false, contentType: imageFile.type });
      if (uploadError) {
        setSubmitState("error"); setSubmitError("Lời chúc đã được giữ, nhưng ảnh chưa tải lên được. Vui lòng thử lại."); return;
      }
    }
    setSubmitState("success"); setScreen("thankyou");
  }

  function beginEdit(wish: Wish) {
    setEditName(wish.sender_name); setEditContent(wish.content ?? ""); setEditStyle(wish.card_style);
    setEditError(""); setEditing(true);
  }

  async function saveEdit() {
    if (!detail || editBusy) return;
    const cleanName = editName.trim(); const cleanContent = editContent.trim();
    if (!cleanName || cleanName.length > 60 || cleanContent.length > 1000 || (!cleanContent && !detail.image_path)) {
      setEditError("Vui lòng nhập tên và giữ lời chúc trong giới hạn 1.000 ký tự."); return;
    }
    setEditBusy(true); setEditError("");
    const cardType = detail.image_path ? (cleanContent ? "mixed" : "image") : "text";
    const { data, error } = await supabase.from("messages")
      .update({ sender_name: cleanName, content: cleanContent || null, card_style: editStyle, card_type: cardType })
      .eq("id", detail.id).select("*").single();
    if (error || !data) { setEditError("Chưa thể lưu thay đổi. Vui lòng thử lại."); setEditBusy(false); return; }
    const updated = { ...(data as MessageRow), image: detail.image };
    setWishes(current => current.map(w => w.id === updated.id ? updated : w));
    setDetail(updated); setEditing(false); setEditBusy(false);
  }

  function resetDraft() {
    setMessage(""); setName(""); setAnonymous(false); setImageFile(undefined);
    if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(undefined);
    setCardStyle("blue"); setSubmitState("idle"); setSubmitError(""); submissionId.current = undefined; submissionImagePath.current = undefined;
  }
  function home() { resetDraft(); setScreen("canvas"); setCamera({ x: -55, y: -20, scale: .92 }); void loadApprovedMessages(); }

  return <main className="app-shell"><div className="phone-stage">
    {screen === "onboarding" && <section className="screen onboarding"><Status/><h1>LET’S CREATE<br/>THE MOMENTS</h1><img className="mascot" src={mascot} alt="Mascot tốt nghiệp của Ngân"/><p>Bước vào không gian tốt nghiệp của Ngân, khám phá những lời nhắn và để lại một điều bạn muốn Ngân luôn nhớ.</p><button className="primary wide" onClick={() => setScreen("canvas")}>Start</button></section>}
    {(screen === "canvas" || screen === "preview" || screen === "thankyou") && <section className="screen canvas-screen">
      <div className="canvas" onPointerDown={down} onPointerMove={move} onPointerUp={() => setDragging(false)} onWheel={wheel}><div className="world" style={{ transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})` }}>{wishes.map(w => <WishCard key={w.id} wish={w} onOpen={() => screen === "canvas" && setDetail(w)}/>)}{screen === "preview" && <WishCard wish={draftWish} featured/>}</div></div><Status canvas/>
      {screen === "canvas" && <>{loadingMessages && <div className="canvas-state">Đang tải lời chúc…</div>}{!loadingMessages && loadError && <div className="canvas-state error">{loadError}<button onClick={loadApprovedMessages}>Thử lại</button></div>}{!loadingMessages && !loadError && wishes.length === 0 && <div className="canvas-state">Chưa có lời chúc nào.<br/>Hãy để lại lời nhắn đầu tiên nhé!</div>}<button className="round-control" aria-label="Đưa canvas về trung tâm" onClick={() => setCamera({ x: -55, y: -20, scale: .92 })}>⌖</button><button className="primary send" onClick={() => setScreen("composer")}>＋&nbsp; Send your wish</button></>}
      {screen === "preview" && <><button className="back floating" onClick={() => setScreen("composer")} aria-label="Quay lại chỉnh sửa">‹</button><div className="preview-label">Your wish preview</div>{submitError && <div className="submit-alert">{submitError}</div>}<button className="primary send" disabled={submitState === "submitting"} onClick={sendMessage}>{submitState === "submitting" ? "Sending…" : "Finish"}</button></>}
      {screen === "thankyou" && <div className="success-layer"><div className="scrim"/><div className="thank-sheet"><h2>THANK YOU FOR<br/>YOUR MESSAGE</h2><img src={thankMascot} alt="Mascot cảm ơn"/><p>Lời chúc đã được lưu và xuất hiện ngay trên canvas.</p><button className="primary wide" onClick={home}>Back To Home</button></div></div>}
    </section>}
    {screen === "composer" && <section className="screen composer"><Status/><button className="back" onClick={() => setScreen("canvas")} aria-label="Quay lại">‹</button><h2>Leave a message</h2><div className="types"><button className="type active">✦<span>Text</span></button><label className={`type ${imageFile ? "active" : ""}`}>▧<span>Photo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick}/></label></div><label className="field message-field"><span>Message</span><textarea value={message} maxLength={1000} onChange={e => setMessage(e.target.value)} placeholder="Kỷ niệm nào với Ngân khiến bạn nhớ nhất?"/><small>{message.length}/1000</small></label>{imagePreview && <div className="image-preview"><img src={imagePreview} alt="Ảnh lời chúc đã chọn"/><button onClick={() => { setImageFile(undefined); setImagePreview(undefined); }}>Remove</button></div>}<div className="style-picker"><span>Card style</span>{(Object.keys(colors) as (keyof typeof colors)[]).map(style => <button key={style} className={cardStyle === style ? "selected" : ""} style={{ background: colors[style] }} onClick={() => setCardStyle(style)} aria-label={`Chọn kiểu thiệp ${style}`}/>)}</div><div className="identity-row"><label className="field"><span>Your name</span><input disabled={anonymous} value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Tên của bạn"/></label><label className="anonymous"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/><span>Anonymous</span></label></div>{submitError && <div className="form-error">{submitError}</div>}<button className="primary wide composer-submit" disabled={!valid} onClick={() => { setSubmitError(""); setScreen("preview"); }}>Send your wish</button></section>}
    {detail && <div className="modal" role="dialog" aria-modal="true" aria-label="Chi tiết lời chúc"><button className="modal-close" onClick={() => { setDetail(undefined); setEditing(false); }}>×</button>{editing ? <div className="edit-sheet"><h3>Edit this wish</h3><label className="field"><span>Your name</span><input value={editName} maxLength={60} onChange={e => setEditName(e.target.value)}/></label><label className="field"><span>Message</span><textarea value={editContent} maxLength={1000} onChange={e => setEditContent(e.target.value)}/></label><div className="style-picker"><span>Card style</span>{(Object.keys(colors) as (keyof typeof colors)[]).map(style => <button key={style} className={editStyle === style ? "selected" : ""} style={{ background: colors[style] }} onClick={() => setEditStyle(style)} aria-label={`Chọn kiểu thiệp ${style}`}/>)}</div>{editError && <div className="form-error">{editError}</div>}<div className="edit-actions"><button onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={editBusy} onClick={saveEdit}>{editBusy ? "Saving…" : "Save changes"}</button></div></div> : <><WishCard wish={detail} featured/><button className="edit-wish" onClick={() => beginEdit(detail)}>Edit wish</button></>}</div>}
  </div><p className="desktop-note">Drag the canvas · scroll to zoom</p></main>;
}

function Status({ canvas = false }: { canvas?: boolean }) { return <div className={`status ${canvas ? "canvas-status" : ""}`}><b>09:41</b><span>● ᴡɪꜰɪ ▰</span></div>; }
function WishCard({ wish, onOpen, featured = false }: { wish: Wish; onOpen?: () => void; featured?: boolean }) { return <button className={`wish-card ${featured ? "featured" : ""}`} onClick={onOpen} style={{ left: wish.canvas_x, top: wish.canvas_y, background: colors[wish.card_style] ?? colors.blue, transform: `rotate(${wish.rotation}deg)` }}><span className="tape">{wish.sender_name}</span>{wish.content && <p>{wish.content}</p>}{wish.image ? <img src={wish.image} alt="Ảnh kèm lời chúc"/> : wish.card_type !== "text" ? <div className="photo-placeholder"><span>Đang tải ảnh…</span></div> : null}</button>; }
