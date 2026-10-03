import { BadgeCheck, Camera, Check, Globe2, Heart, ImagePlus, LoaderCircle, LockKeyhole, MessageCircle, MessageSquare, Paperclip, Pencil, Repeat2, Save, Search, Send, Trash2, UserPlus, UserRound, Users, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  parseMessageContent,
  type DirectMessage,
  type Friendship,
  type MessageAttachment,
  type PublicProfile,
  type SocialPost,
  type SocialVisibility,
  type UserProfile,
  workspaceApi,
} from '../../lib/workspaceApi'
import { PrivateAttachment } from './PrivateAttachment'

function initials(name: string) {
  return name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()
}

function Avatar({ profile }: { profile: Pick<PublicProfile, 'avatar_url' | 'full_name'> }) {
  return profile.avatar_url
    ? <img className="social-avatar" src={profile.avatar_url} alt="" />
    : <span className="social-avatar fallback" aria-hidden="true">{initials(profile.full_name)}</span>
}

function VerifiedAdminBadge() {
  return <BadgeCheck size={16} color="#48a8ff" aria-label="Quản trị viên Nexamin" />
}

function presenceLabel(profile: Pick<PublicProfile, 'is_online' | 'last_seen_at'>) {
  if (profile.is_online) return 'Đang hoạt động'
  if (!profile.last_seen_at) return 'Ngoại tuyến'
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(profile.last_seen_at).getTime()) / 60_000))
  if (elapsedMinutes < 1) return 'Vừa hoạt động'
  if (elapsedMinutes < 60) return `Hoạt động ${elapsedMinutes} phút trước`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `Hoạt động ${elapsedHours} giờ trước`
  return `Hoạt động ${Math.floor(elapsedHours / 24)} ngày trước`
}

export function ProfileView({ onProfileChange }: { onProfileChange?: (profile: UserProfile) => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    const next = await workspaceApi.fullProfile()
    setProfile(next)
    onProfileChange?.(next)
    return next
  }, [onProfileChange])

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Không tải được hồ sơ.')
    })
  }, [refresh])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const year = String(data.get('student_year') ?? '')
    setBusy(true); setError(''); setNotice('')
    try {
      await workspaceApi.updateProfile({
        full_name: String(data.get('full_name') ?? '').trim(),
        student_year: year ? Number(year) : null,
        bio: String(data.get('bio') ?? '').trim() || null,
      })
      await refresh(); setEditing(false); setNotice('Đã cập nhật hồ sơ.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được hồ sơ.') }
    finally { setBusy(false) }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh đại diện không được vượt quá 5 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try { await workspaceApi.uploadAvatar(file); await refresh(); setNotice('Đã cập nhật ảnh đại diện.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được ảnh đại diện.') }
    finally { setBusy(false); event.target.value = '' }
  }

  if (error && !profile) return <section className="workspace-state"><h2>Không mở được hồ sơ</h2><p>{error}</p></section>
  if (!profile) return <section className="workspace-state"><LoaderCircle className="spin" /><p>Đang mở hồ sơ…</p></section>

  const stats = profile.study_statistics
  return <section className="profile-page" aria-labelledby="profile-title">
    <div className="profile-identity">
      <div className="avatar-editor"><Avatar profile={profile} /><label className="avatar-upload"><Camera size={16} /><span>Đổi ảnh</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={busy} /></label></div>
      <div><h2 id="profile-title">{profile.full_name}{profile.role === 'admin' && <VerifiedAdminBadge />}</h2><p>{profile.major ?? 'Chưa chọn ngành học'}</p><span>{profile.university?.name ?? 'Chưa cập nhật trường'}</span></div>
      <button className="secondary-action profile-edit-button" type="button" onClick={() => setEditing((value) => !value)} disabled={busy}>{editing ? <X size={16} /> : <Pencil size={16} />}{editing ? 'Hủy' : 'Chỉnh sửa'}</button>
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p className="inline-success" role="status">{notice}</p>}
    {editing ? <form className="profile-form" onSubmit={save}>
      <label>Họ và tên<input name="full_name" required minLength={2} maxLength={150} defaultValue={profile.full_name} /></label>
      <label>Năm học<select name="student_year" defaultValue={profile.student_year ?? ''}><option value="">Chưa cập nhật</option>{[1,2,3,4,5,6,7,8,9,10].map((year) => <option key={year} value={year}>Năm {year}</option>)}</select></label>
      <label className="profile-form-wide">Giới thiệu<textarea name="bio" rows={5} maxLength={1000} defaultValue={profile.bio ?? ''} placeholder="Chia sẻ mục tiêu và sở thích học tập của bạn…" /></label>
      <p className="profile-form-note">Trường và ngành học lấy từ dữ liệu tuyển sinh đã chọn khi đăng ký.</p>
      <button className="primary-action" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Lưu thay đổi</button>
    </form> : <div className="profile-layout">
      <dl className="profile-details">
        <div><dt>Email</dt><dd>{profile.email}</dd></div>
        <div><dt>Trường</dt><dd>{profile.university?.name ?? 'Chưa cập nhật'}</dd></div>
        <div><dt>Ngành học</dt><dd>{profile.major ?? 'Chưa cập nhật'}</dd></div>
        <div><dt>Năm học</dt><dd>{profile.student_year ? 'Năm ' + profile.student_year : 'Chưa cập nhật'}</dd></div>
        <div><dt>Giới thiệu</dt><dd>{profile.bio ?? 'Chưa có phần giới thiệu'}</dd></div>
        <div><dt>Trạng thái</dt><dd>{profile.is_verified ? 'Đã xác minh' : 'Tài khoản đang hoạt động'}</dd></div>
        <div><dt>Ngày tham gia</dt><dd>{profile.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'Không xác định'}</dd></div>
      </dl>
      <div className="profile-stats" aria-label="Thống kê học tập">
        <div><strong>{stats?.courses_count ?? 0}</strong><span>Môn học</span></div>
        <div><strong>{stats?.documents_count ?? 0}</strong><span>Tài liệu</span></div>
        <div><strong>{stats?.quizzes_completed ?? 0}</strong><span>Quiz đã làm</span></div>
        <div><strong>{Math.round((stats?.average_mastery ?? 0) * 100)}%</strong><span>Mức thành thạo</span></div>
      </div>
    </div>}
  </section>
}

function socialTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ`
  return new Date(value).toLocaleDateString('vi-VN')
}

function VisibilityMark({ value }: { value: SocialVisibility }) {
  if (value === 'private') return <><LockKeyhole size={13} /> Riêng tư</>
  if (value === 'friends') return <><Users size={13} /> Bạn bè</>
  return <><Globe2 size={13} /> Công khai</>
}

export function CommunityFeedView({ profile }: { profile: UserProfile | null }) {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [people, setPeople] = useState<PublicProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null)
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<SocialVisibility>('public')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadFeed = useCallback(async (profileId?: string) => {
    setLoading(true); setError('')
    try { setPosts(await workspaceApi.socialFeed(profileId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được bảng tin.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadFeed() }, [loadFeed])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  async function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim()
    setSearched(Boolean(query))
    if (!query) { setPeople([]); return }
    setBusy(true)
    try { setPeople(await workspaceApi.people(query)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tìm được người dùng.') }
    finally { setBusy(false) }
  }

  async function openProfile(person: PublicProfile) {
    setSelectedProfile(person)
    await loadFeed(person.id)
  }

  async function showAllPosts() {
    setSelectedProfile(null)
    await loadFeed()
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh đăng không được vượt quá 8 MB.'); event.target.value = ''; return
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setError(''); event.target.value = ''
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null); setImagePreview('')
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content.trim() && !imageFile) return
    setBusy(true); setError('')
    try {
      const uploaded = imageFile ? await workspaceApi.uploadSocialImage(imageFile) : null
      const post = await workspaceApi.createSocialPost({ content: content.trim(), image_url: uploaded?.url, visibility })
      setSelectedProfile(null); setPosts((current) => [post, ...current]); setContent(''); clearImage()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không đăng được bài viết.') }
    finally { setBusy(false) }
  }

  function replacePost(next: SocialPost) {
    setPosts((current) => current.map((post) => post.id === next.id ? next : post))
  }

  async function mutatePost(action: () => Promise<SocialPost>, addToTop = false) {
    setBusy(true); setError('')
    try {
      const next = await action()
      if (addToTop) { setSelectedProfile(null); setPosts((current) => [next, ...current]) }
      else replacePost(next)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Thao tác chưa hoàn tất.') }
    finally { setBusy(false) }
  }

  async function removePost(postId: string) {
    setBusy(true)
    try { await workspaceApi.deleteSocialPost(postId); setPosts((current) => current.filter((post) => post.id !== postId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xóa được bài viết.') }
    finally { setBusy(false) }
  }

  async function actRelationship(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      if (selectedProfile) setSelectedProfile(await workspaceApi.publicProfile(selectedProfile.id))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được kết nối.') }
    finally { setBusy(false) }
  }

  const publicSelf: PublicProfile | null = profile ? {
    id: profile.id, full_name: profile.full_name, is_admin: profile.role === 'admin' && Boolean(profile.is_verified), avatar_url: profile.avatar_url,
    university: profile.university, major: profile.major, student_year: profile.student_year,
    bio: profile.bio, friendship_id: null, friendship_status: null, request_incoming: false,
    is_online: true, last_seen_at: null,
  } : null
  const viewedProfile = selectedProfile ?? publicSelf

  return <section className="social-network" aria-labelledby="community-feed-title">
    <header className="social-network-heading"><div>
      <h2 id="community-feed-title">{selectedProfile ? selectedProfile.full_name : 'Cộng đồng học tập'}</h2>
      <p>{selectedProfile ? 'Bài viết được chia sẻ với bạn.' : 'Chia sẻ tiến độ, trao đổi kiến thức và kết nối với sinh viên khác.'}</p>
    </div>{selectedProfile && <button type="button" className="secondary-action" onClick={() => void showAllPosts()}>Quay lại bảng tin</button>}</header>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="social-network-grid">
      <aside className="social-discovery" aria-label="Tìm người dùng">
        {publicSelf && <button className="social-self" type="button" onClick={() => void openProfile(publicSelf)}><Avatar profile={publicSelf} /><span><strong>{publicSelf.full_name}</strong><small>Xem trang cá nhân</small></span></button>}
        <form className="social-user-search" onSubmit={searchPeople}><Search size={17} aria-hidden="true" /><input name="query" aria-label="Tìm người dùng theo tên" placeholder="Tìm người dùng…" autoComplete="off" /><button type="submit" disabled={busy} aria-label="Tìm"><Search size={16} /></button></form>
        {searched && <div className="social-search-results"><h3>Kết quả tìm kiếm</h3>{people.length === 0 ? <p>Không tìm thấy tên phù hợp.</p> : people.map((person) => <button type="button" key={person.id} onClick={() => void openProfile(person)}><Avatar profile={person} /><span><strong>{person.full_name}{person.is_admin && <VerifiedAdminBadge />}</strong><small>{person.university?.short_name ?? person.major ?? 'Sinh viên'}</small></span></button>)}</div>}
      </aside>
      <main className="social-feed-column">
        {!selectedProfile && <form className="social-composer" onSubmit={publish}>
          <div className="social-composer-top">{publicSelf && <Avatar profile={publicSelf} />}<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={3} placeholder="Bạn đang học gì hôm nay?" aria-label="Nội dung bài viết" /></div>
          {imagePreview && <div className="social-image-preview"><img src={imagePreview} alt="Ảnh chuẩn bị đăng" /><button type="button" onClick={clearImage} aria-label="Bỏ ảnh"><X size={16} /></button></div>}
          <div className="social-composer-actions">
            <label className="social-image-picker"><ImagePlus size={18} /><span>Thêm ảnh</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseImage} disabled={busy} /></label>
            <label className="social-visibility"><span>Ai có thể xem</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as SocialVisibility)}><option value="public">Công khai</option><option value="friends">Bạn bè</option><option value="private">Riêng tư</option></select></label>
            <span className="social-character-count">{content.length}/2000</span>
            <button className="primary-action" type="submit" disabled={busy || (!content.trim() && !imageFile)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Đăng</button>
          </div>
        </form>}
        <div className="social-feed" aria-live="polite">
          {loading ? <div className="social-feed-loading" aria-label="Đang tải bảng tin"><span /><span /><span /></div> : posts.length === 0 ? <div className="social-feed-empty"><MessageSquare size={28} /><h3>Chưa có bài viết phù hợp</h3><p>{selectedProfile ? 'Người dùng này chưa chia sẻ bài viết với bạn.' : 'Hãy đăng cập nhật học tập đầu tiên của bạn.'}</p></div> : posts.map((post) => <SocialPostCard key={post.id} post={post} ownId={profile?.id} busy={busy} onAuthor={openProfile} onLike={() => mutatePost(() => workspaceApi.togglePostLike(post.id))} onComment={(comment) => mutatePost(() => workspaceApi.commentPost(post.id, comment))} onRepost={() => mutatePost(() => workspaceApi.repostPost(post.id, post.visibility === 'private' ? 'private' : post.visibility), true)} onDelete={() => removePost(post.id)} />)}
        </div>
      </main>
      <aside className="social-profile-panel" aria-label="Hồ sơ đang xem">
        {viewedProfile ? <><div className="social-profile-cover" aria-hidden="true"><span /></div><div className="social-profile-body"><Avatar profile={viewedProfile} /><h3>{viewedProfile.full_name}{viewedProfile.is_admin && <VerifiedAdminBadge />}</h3><p>{viewedProfile.bio ?? 'Chưa có phần giới thiệu.'}</p><dl><div><dt>Trường</dt><dd>{viewedProfile.university?.name ?? 'Chưa cập nhật'}</dd></div><div><dt>Ngành</dt><dd>{viewedProfile.major ?? 'Chưa cập nhật'}</dd></div>{viewedProfile.student_year && <div><dt>Năm học</dt><dd>Năm {viewedProfile.student_year}</dd></div>}</dl><span className={viewedProfile.is_online ? 'presence online' : 'presence'}><i aria-hidden="true" />{presenceLabel(viewedProfile)}</span>{selectedProfile && <FriendAction profile={selectedProfile} busy={busy} onAct={actRelationship} />}</div></> : <div className="social-profile-placeholder"><UserRound size={28} /><p>Chọn một người để xem hồ sơ.</p></div>}
      </aside>
    </div>
  </section>
}

function SocialPostCard({ post, ownId, busy, onAuthor, onLike, onComment, onRepost, onDelete }: {
  post: SocialPost; ownId: string | undefined; busy: boolean
  onAuthor: (profile: PublicProfile) => Promise<void>; onLike: () => Promise<void>
  onComment: (content: string) => Promise<void>; onRepost: () => Promise<void>; onDelete: () => Promise<void>
}) {
  const [comment, setComment] = useState('')
  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const value = comment.trim(); if (!value) return
    await onComment(value); setComment('')
  }
  return <article className="social-post">
    <header><button type="button" className="social-post-author" onClick={() => void onAuthor(post.author)}><Avatar profile={post.author} /><span><strong>{post.author.full_name}{post.author.is_admin && <VerifiedAdminBadge />}</strong><small>{post.author.university?.short_name ?? post.author.major ?? 'Sinh viên'}</small></span></button><span className="social-post-meta"><span>{socialTime(post.created_at)}</span><span><VisibilityMark value={post.visibility} /></span></span>{post.author.id === ownId && <button type="button" className="social-post-delete" onClick={() => void onDelete()} disabled={busy} aria-label="Xóa bài viết"><Trash2 size={16} /></button>}</header>
    {post.content && <p className="social-post-content">{post.content}</p>}
    {post.image_url && <a className="social-post-image" href={post.image_url} target="_blank" rel="noreferrer"><img src={post.image_url} alt="Ảnh trong bài viết của người dùng" /></a>}
    {post.repost_of && <div className="social-repost-preview"><button type="button" onClick={() => void onAuthor(post.repost_of!.author)}><Avatar profile={post.repost_of.author} /><strong>{post.repost_of.author.full_name}</strong></button>{post.repost_of.content && <p>{post.repost_of.content}</p>}{post.repost_of.image_url && <img src={post.repost_of.image_url} alt="Ảnh trong bài viết gốc" />}</div>}
    <div className="social-post-counts" aria-label="Tương tác bài viết"><span>{post.like_count} lượt thích</span><span>{post.comment_count} bình luận</span><span>{post.repost_count} lượt đăng lại</span></div>
    <div className="social-post-actions"><button type="button" className={post.liked_by_me ? 'active' : ''} onClick={() => void onLike()} disabled={busy}><Heart size={18} fill={post.liked_by_me ? 'currentColor' : 'none'} /> Thích</button><label htmlFor={`comment-${post.id}`}><MessageSquare size={18} /> Bình luận</label><button type="button" onClick={() => void onRepost()} disabled={busy}><Repeat2 size={18} /> Đăng lại</button></div>
    {post.comments.length > 0 && <div className="social-comments">{post.comments.map((entry) => <div key={entry.id}><Avatar profile={entry.author} /><p><strong>{entry.author.full_name}</strong>{entry.content}<time>{socialTime(entry.created_at)}</time></p></div>)}</div>}
    <form className="social-comment-form" onSubmit={submitComment}><input id={`comment-${post.id}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Viết bình luận…" aria-label={`Bình luận bài viết của ${post.author.full_name}`} /><button type="submit" disabled={busy || !comment.trim()} aria-label="Gửi bình luận"><Send size={16} /></button></form>
  </article>
}

export function MessagesView({ ownId, onMessagesRead }: { ownId: string | undefined; onMessagesRead: () => void }) {
  const [people, setPeople] = useState<PublicProfile[]>([])
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [selected, setSelected] = useState<PublicProfile | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const selectedId = selected?.id

  const reload = useCallback(async (query = '') => {
    setLoading(true)
    setError('')
    try {
      const [nextPeople, nextFriendships] = await Promise.all([
        workspaceApi.people(query),
        workspaceApi.friendships(),
      ])
      setPeople(nextPeople)
      setFriendships(nextFriendships)
      if (selected) {
        const fresh = nextPeople.find((person) => person.id === selected.id)
          ?? nextFriendships.find((item) => item.profile.id === selected.id)?.profile
        if (fresh) setSelected(fresh)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được cộng đồng.')
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => { void reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected?.friendship_status !== 'accepted') { setMessages([]); return }
    workspaceApi.messages(selected.id).then((items) => { setMessages(items); onMessagesRead() }).catch(() => setMessages([]))
  }, [selected, onMessagesRead])

  useEffect(() => {
    const refreshPresence = async () => {
      try {
        const nextFriendships = await workspaceApi.friendships()
        setFriendships(nextFriendships)
        if (selectedId) setSelected(await workspaceApi.publicProfile(selectedId))
      } catch {
        // The next interval or a user action retries without interrupting messaging.
      }
    }
    const timer = window.setInterval(() => { void refreshPresence() }, 30_000)
    return () => window.clearInterval(timer)
  }, [selectedId])

  useEffect(() => {
    const receive = (raw: Event) => {
      const message = (raw as CustomEvent<DirectMessage>).detail
      if (!selected || (message.sender_id !== selected.id && message.recipient_id !== selected.id)) return
      setMessages((items) => items.some((item) => item.id === message.id) ? items : [...items, message])
      if (message.sender_id === selected.id) {
        void workspaceApi.messages(selected.id).then((items) => { setMessages(items); onMessagesRead() })
      }
    }
    window.addEventListener('studyhub:message', receive)
    return () => window.removeEventListener('studyhub:message', receive)
  }, [selected, onMessagesRead])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim()
    setHasSearched(Boolean(query))
    if (!query) { setPeople([]); return }
    await reload(query)
  }

  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try {
      await action()
      await reload()
      setHasSearched(false)
      onMessagesRead()
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Thao tác chưa hoàn tất.') }
    finally { setBusy(false) }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const content = draft.trim()
    if (!content && !pendingAttachment) return
    setBusy(true)
    try {
      const message = await workspaceApi.sendMessage(selected.id, content, pendingAttachment)
      setMessages((items) => [...items, message])
      setDraft('')
      setPendingAttachment(null)
      onMessagesRead()
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không gửi được tin nhắn.') }
    finally { setBusy(false) }
  }

  async function chooseAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const attachment = await workspaceApi.uploadMessageAttachment(file)
      setPendingAttachment(attachment)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không đính kèm được tệp.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const accepted = friendships.filter((item) => item.status === 'accepted')
  const incoming = friendships.filter((item) => item.status === 'pending' && item.request_incoming)

  return <section className="community-page" aria-labelledby="messages-title">
    <div className="community-heading"><div><h2 id="messages-title">Tin nhắn</h2><p>Tìm chính xác người bạn cần theo tên. Tin nhắn chỉ mở khi hai người đã kết bạn.</p></div>
      <form className="people-search" onSubmit={search}><Search size={17} /><input name="query" aria-label="Tìm người" placeholder="Nhập tên người dùng…" /><button type="submit">Tìm</button></form>
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="community-layout">
      <aside className="people-panel" aria-label="Danh sách người dùng">
        {incoming.length > 0 && <div className="people-section"><h3>Lời mời kết bạn</h3>{incoming.map((item) => <PersonRow key={item.id} profile={item.profile} onSelect={setSelected} action={<><button disabled={busy} aria-label={`Chấp nhận ${item.profile.full_name}`} onClick={() => void act(() => workspaceApi.acceptFriend(item.id))}><Check size={16} /></button><button disabled={busy} aria-label={`Từ chối ${item.profile.full_name}`} onClick={() => void act(() => workspaceApi.removeFriend(item.id))}><X size={16} /></button></>} />)}</div>}
        {accepted.length > 0 && <div className="people-section"><h3>Bạn bè</h3>{accepted.map((item) => <PersonRow key={item.id} profile={item.profile} onSelect={setSelected} action={<MessageCircle size={17} />} />)}</div>}
        {hasSearched && <div className="people-section"><h3>Kết quả tìm kiếm</h3>{loading ? <p>Đang tìm…</p> : people.length === 0 ? <p>Không tìm thấy tên phù hợp.</p> : people.map((person) => <PersonRow key={person.id} profile={person} onSelect={setSelected} />)}</div>}
      </aside>
      <div className="social-detail">
        {!selected ? <div className="social-empty"><UserRound size={30} /><h3>Chọn một người để xem hồ sơ</h3><p>Hồ sơ công khai chỉ hiển thị tên, trường và ngành học.</p></div> : <>
          <div className="public-profile"><Avatar profile={selected} /><div><h3>{selected.full_name}</h3><p>{selected.university?.name ?? 'Chưa cập nhật trường'}</p><span>{selected.major ?? 'Chưa cập nhật ngành học'}</span><small className={selected.is_online ? 'presence online' : 'presence'}><i aria-hidden="true" />{presenceLabel(selected)}</small></div><FriendAction profile={selected} busy={busy} onAct={act} /></div>
          {selected.friendship_status === 'accepted' && <div className="direct-chat"><div className="message-thread">{messages.length === 0 ? <p className="chat-empty">Chưa có tin nhắn. Hãy bắt đầu bằng một lời chào.</p> : messages.map((message) => {
            const payload = parseMessageContent(message.content)
            return <div className={message.sender_id === ownId ? 'direct-message mine' : 'direct-message'} key={message.id}><p>{payload.text || 'Tệp đính kèm'}</p>{payload.attachment && (
              <PrivateAttachment messageId={message.id} attachment={payload.attachment} />
            )}<time>{new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>
          })}</div><form onSubmit={send}><input name="content" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} autoComplete="off" placeholder={`Nhắn cho ${selected.full_name}…`} /><label className="upload-attachment" aria-label="Đính kèm ảnh hoặc tệp"><Paperclip size={16} /><input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={chooseAttachment} disabled={busy} /></label>{pendingAttachment && <span className="pending-attachment"><span>{pendingAttachment.name}</span><button type="button" aria-label="Bỏ tệp đính kèm" onClick={() => setPendingAttachment(null)}><X size={13} /></button></span>}<button className="primary-action" disabled={busy || (!pendingAttachment && !draft.trim())} aria-label="Gửi tin nhắn"><Send size={17} /></button></form></div>}
        </>}
      </div>
    </div>
  </section>
}

export const CommunityView = MessagesView

function PersonRow({ profile, onSelect, action }: { profile: PublicProfile; onSelect: (profile: PublicProfile) => void; action?: React.ReactNode }) {
  return <div className="person-row"><button className="person-select" type="button" onClick={() => onSelect(profile)}><Avatar profile={profile} /><span><strong>{profile.full_name}</strong><small>{profile.university?.short_name ?? profile.major ?? 'Sinh viên'}</small><small className={profile.is_online ? 'presence online' : 'presence'}><i aria-hidden="true" />{presenceLabel(profile)}</small></span></button><i>{action}</i></div>
}

function FriendAction({ profile, busy, onAct }: { profile: PublicProfile; busy: boolean; onAct: (action: () => Promise<unknown>) => Promise<void> }) {
  if (!profile.friendship_status) return <button className="secondary-action" disabled={busy} onClick={() => void onAct(() => workspaceApi.requestFriend(profile.id))}><UserPlus size={17} /> Kết bạn</button>
  const friendshipId = profile.friendship_id
  if (profile.friendship_status === 'pending' && profile.request_incoming && friendshipId) return <button className="secondary-action" disabled={busy} onClick={() => void onAct(() => workspaceApi.acceptFriend(friendshipId))}><Check size={17} /> Chấp nhận</button>
  if (profile.friendship_status === 'pending') return <span className="relationship-label">Đã gửi lời mời</span>
  return <span className="relationship-label"><MessageCircle size={15} /> Bạn bè</span>
}
