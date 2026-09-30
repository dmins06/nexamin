import { Component, type ReactNode } from 'react'

export function AnatomyFailure({ onRetry }: { onRetry: () => void }) {
  return <div className="anatomy-status" role="alert"><h3>Không thể tải mô hình giải phẫu.</h3><p>Kiểm tra kết nối và khả năng hỗ trợ WebGL của trình duyệt. Các mục khác của Nexamin vẫn sử dụng được.</p><button onClick={onRetry}>Thử lại</button></div>
}

export class AnatomyErrorBoundary extends Component<{ children: ReactNode; onRetry?: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <AnatomyFailure onRetry={() => { this.props.onRetry?.(); this.setState({ failed: false }) }} /> : this.props.children
  }
}
