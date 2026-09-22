import { Camera, Check, LoaderCircle, MessageCircle, Pencil, Save, Search, Send, UserPlus, UserRound, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  parseMessageContent,
  type DirectMessage,
  type Friendship,
  type MessageAttachment,
  type PublicProfile,
  type UserProfile,
  workspaceApi,
} from '../../lib/workspaceApi'

function initials(name: string) {
  return name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()
}

function Avatar({ profile }: { profile: Pick<PublicProfile, 'avatar_url' | 'full_name'> }) {
  return profile.avatar_url
    ? <img className="social-avatar" src={profile.avatar_url} alt="" />
    : <span className="social-avatar fallback" aria-hidden="true">{initials(profile.full_name)}</span>
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
      <div><h2 id="profile-title">{profile.full_name}</h2><p>{profile.major ?? 'Chưa chọn ngành học'}</p><span>{profile.university?.name ?? 'Chưa cập nhật trường'}</span></div>
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

export function CommunityFeedView({ profile }: { profile: UserProfile | null }) {
  const [post, setPost] = useState('')
  const [posts, setPosts] = useState<Array<{ id: string; author: string; content: string; time: string; avatar: string | null }>>([])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = post.trim()
    if (!next) return
    setPosts((current) => [{
      id: `post-${Date.now()}`,
      author: profile?.full_name ?? 'Bạn',
      content: next,
      time: 'Vừa xong',
      avatar: profile?.avatar_url ?? null,
    }, ...current])
    setPost('')
  }

  return <section className="community-page" aria-labelledby="community-feed-title">
    <div className="community-heading">
      <div>
        <h2 id="community-feed-title">Cộng đồng</h2>
        <p>Xem hồ sơ, cập nhật trạng thái và chia sẻ những điều bạn đang học trong cộng đồng.</p>
      </div>
    </div>

    <div className="community-layout">
      <aside className="people-panel" aria-label="Hồ sơ cộng đồng">
        <div className="public-profile" style={{ border: 0, padding: 0 }}>
          <Avatar profile={profile ?? { full_name: 'Bạn', avatar_url: null }} />
          <div>
            <h3>{profile?.full_name ?? 'Bạn'}</h3>
            <p>{profile?.university?.name ?? 'Chưa cập nhật trường'}</p>
            <span>{profile?.major ?? 'Chưa cập nhật ngành học'}</span>
          </div>
        </div>
      </aside>

      <div className="social-detail">
        <div className="social-post-composer">
          <form onSubmit={submit} className="social-post-form">
            <textarea
              aria-label="Viết bài đăng mới"
              value={post}
              onChange={(event) => setPost(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Bạn đang học gì hôm nay?"
            />
            <div className="social-post-actions">
              <span>{post.trim().length}/500</span>
              <button className="primary-action" type="submit" disabled={!post.trim()}>Đăng bài</button>
            </div>
          </form>
        </div>

        <div className="message-thread social-feed-list">
          {posts.map((entry) => (
            <article className="social-post-card" key={entry.id}>
              <div className="social-post-header">
                {entry.avatar ? <img className="social-avatar" src={entry.avatar} alt="" /> : <span className="social-avatar fallback" aria-hidden="true">{initials(entry.author)}</span>}
                <div>
                  <strong>{entry.author}</strong>
                  <small>{entry.time}</small>
                </div>
              </div>
              <p>{entry.content}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>
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
  const [error, setError] = useState('')

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
    await reload(String(new FormData(event.currentTarget).get('query') ?? ''))
  }

  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try {
      await action()
      await reload()
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
    <div className="community-heading"><div><h2 id="messages-title">Tin nhắn</h2><p>Tìm bạn theo tên, trường hoặc ngành học. Tin nhắn chỉ mở khi hai người đã kết bạn.</p></div>
      <form className="people-search" onSubmit={search}><Search size={17} /><input name="query" aria-label="Tìm người" placeholder="Tên, trường hoặc ngành…" /><button type="submit">Tìm</button></form>
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="community-layout">
      <aside className="people-panel" aria-label="Danh sách người dùng">
        {incoming.length > 0 && <div className="people-section"><h3>Lời mời kết bạn</h3>{incoming.map((item) => <PersonRow key={item.id} profile={item.profile} onSelect={setSelected} action={<><button disabled={busy} aria-label={`Chấp nhận ${item.profile.full_name}`} onClick={() => void act(() => workspaceApi.acceptFriend(item.id))}><Check size={16} /></button><button disabled={busy} aria-label={`Từ chối ${item.profile.full_name}`} onClick={() => void act(() => workspaceApi.removeFriend(item.id))}><X size={16} /></button></>} />)}</div>}
        {accepted.length > 0 && <div className="people-section"><h3>Bạn bè</h3>{accepted.map((item) => <PersonRow key={item.id} profile={item.profile} onSelect={setSelected} action={<MessageCircle size={17} />} />)}</div>}
        <div className="people-section"><h3>Khám phá</h3>{loading ? <p>Đang tìm…</p> : people.length === 0 ? <p>Chưa tìm thấy người dùng khác.</p> : people.map((person) => <PersonRow key={person.id} profile={person} onSelect={setSelected} />)}</div>
      </aside>
      <div className="social-detail">
        {!selected ? <div className="social-empty"><UserRound size={30} /><h3>Chọn một người để xem hồ sơ</h3><p>Hồ sơ công khai chỉ hiển thị tên, trường và ngành học.</p></div> : <>
          <div className="public-profile"><Avatar profile={selected} /><div><h3>{selected.full_name}</h3><p>{selected.university?.name ?? 'Chưa cập nhật trường'}</p><span>{selected.major ?? 'Chưa cập nhật ngành học'}</span></div><FriendAction profile={selected} busy={busy} onAct={act} /></div>
          {selected.friendship_status === 'accepted' && <div className="direct-chat"><div className="message-thread">{messages.length === 0 ? <p className="chat-empty">Chưa có tin nhắn. Hãy bắt đầu bằng một lời chào.</p> : messages.map((message) => {
            const payload = parseMessageContent(message.content)
            return <div className={message.sender_id === ownId ? 'direct-message mine' : 'direct-message'} key={message.id}><p>{payload.text || 'Tệp đính kèm'}</p>{payload.attachment && (
              <div className="message-attachment"><a href={payload.attachment.url} target="_blank" rel="noreferrer">{payload.attachment.mime_type.startsWith('image/') ? <img src={payload.attachment.url} alt={payload.attachment.name} /> : <span>{payload.attachment.name}</span>}</a></div>
            )}<time>{new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>
          })}</div><form onSubmit={send}><input name="content" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} autoComplete="off" placeholder={`Nhắn cho ${selected.full_name}…`} /><label className="upload-attachment"><Camera size={16} /><input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={chooseAttachment} disabled={busy} /></label>{pendingAttachment && <span className="pending-attachment">{pendingAttachment.name}</span>}<button className="primary-action" disabled={busy || (!pendingAttachment && !draft.trim())} aria-label="Gửi tin nhắn"><Send size={17} /></button></form></div>}
        </>}
      </div>
    </div>
  </section>
}

export const CommunityView = MessagesView

function PersonRow({ profile, onSelect, action }: { profile: PublicProfile; onSelect: (profile: PublicProfile) => void; action?: React.ReactNode }) {
  return <div className="person-row"><button className="person-select" type="button" onClick={() => onSelect(profile)}><Avatar profile={profile} /><span><strong>{profile.full_name}</strong><small>{profile.university?.short_name ?? profile.major ?? 'Sinh viên'}</small></span></button><i>{action}</i></div>
}

function FriendAction({ profile, busy, onAct }: { profile: PublicProfile; busy: boolean; onAct: (action: () => Promise<unknown>) => Promise<void> }) {
  if (!profile.friendship_status) return <button className="secondary-action" disabled={busy} onClick={() => void onAct(() => workspaceApi.requestFriend(profile.id))}><UserPlus size={17} /> Kết bạn</button>
  const friendshipId = profile.friendship_id
  if (profile.friendship_status === 'pending' && profile.request_incoming && friendshipId) return <button className="secondary-action" disabled={busy} onClick={() => void onAct(() => workspaceApi.acceptFriend(friendshipId))}><Check size={17} /> Chấp nhận</button>
  if (profile.friendship_status === 'pending') return <span className="relationship-label">Đã gửi lời mời</span>
  return <span className="relationship-label"><MessageCircle size={15} /> Bạn bè</span>
}
