import {
  Code2,
  Workflow,
  Cpu,
  Network,
  Layers,
  Database,
  BrainCircuit,
  ShieldCheck,
} from 'lucide-react'
import type { ITLabDefinition } from './itLabTypes'
export const itLabRegistry: readonly ITLabDefinition[] = [
  {
    id: 'code',
    title: 'Code Lab',
    icon: Code2,
    status: 'beta',
    route: '/labs/it/code',
    description:
      'Viết, chạy và kiểm thử chương trình trong môi trường tách biệt trên thiết bị của bạn.',
    topics: ['Python', 'C / C++', 'Java', 'JavaScript'],
    next: 'Bài tập nhập môn và test công khai; không phải hệ thống chấm điểm.',
  },
  {
    id: 'algorithms',
    title: 'Algorithm Lab',
    icon: Workflow,
    status: 'beta',
    route: '/labs/it/algorithms',
    description:
      'Theo dõi từng phép so sánh, di chuyển và duyệt đồ thị cùng mã giả tương ứng.',
    topics: ['Sắp xếp', 'Tìm kiếm', 'BFS / DFS', 'Dijkstra'],
    next: 'Mô phỏng thuật toán định sẵn, chưa truy vết code tùy ý.',
  },
  {
    id: 'computer',
    title: 'Computer Architecture',
    icon: Cpu,
    status: 'coming-soon',
    route: '/labs/it/computer',
    description:
      'Khám phá cách các thành phần máy tính phối hợp thực thi lệnh.',
    topics: ['CPU / RAM', 'Cache', 'Thanh ghi', 'Fetch–Decode–Execute'],
    next: 'Giai đoạn 2: mô hình CPU giáo dục; không mô tả đầy đủ vi kiến trúc thực.',
  },
  {
    id: 'network',
    title: 'Network Lab',
    icon: Network,
    status: 'coming-soon',
    route: '/labs/it/network',
    description:
      'Xây dựng mạng mẫu và tìm hiểu vì sao một gói tin đến được đích.',
    topics: ['IP / Subnet', 'Router / Switch', 'Packet', 'TCP / IPv4'],
    next: 'Giai đoạn 3: topology và packet mô phỏng; không gửi gói đến mạng thật.',
  },
  {
    id: 'os',
    title: 'Operating System',
    icon: Layers,
    status: 'coming-soon',
    route: '/labs/it/os',
    description:
      'Thực nghiệm lập lịch CPU, quản lý bộ nhớ và tranh chấp tài nguyên.',
    topics: ['FCFS / SJF', 'Round Robin', 'Memory', 'Deadlock'],
    next: 'Giai đoạn 2: timeline và chỉ số lập lịch; dữ liệu tiến trình mẫu độc lập hệ điều hành thật.',
  },
  {
    id: 'database',
    title: 'Database Lab',
    icon: Database,
    status: 'coming-soon',
    route: '/labs/it/database',
    description:
      'Học SQL và quan hệ dữ liệu trên cơ sở dữ liệu thực hành riêng.',
    topics: ['SQL', 'JOIN', 'Index', 'ERD'],
    next: 'Giai đoạn 2: SQLite trong trình duyệt, tuyệt đối không kết nối database Nexamin.',
  },
  {
    id: 'ai',
    title: 'AI / Machine Learning',
    icon: BrainCircuit,
    status: 'coming-soon',
    route: '/labs/it/ai',
    description:
      'Quan sát mô hình học từ dữ liệu và thay đổi dự đoán khi điều chỉnh tham số.',
    topics: ['Regression', 'KNN / KMeans', 'Decision Tree', 'Neural Network'],
    next: 'Giai đoạn 3: mô hình nhỏ, trực quan; không thay thế framework huấn luyện chuyên nghiệp.',
  },
  {
    id: 'security',
    title: 'Security Lab',
    icon: ShieldCheck,
    status: 'coming-soon',
    route: '/labs/it/security',
    description:
      'Hiểu bảo mật qua mô hình giáo dục và cách phòng ngừa lỗi lập trình.',
    topics: ['Hash / Salt', 'Cryptography', 'Authentication', 'Secure Coding'],
    next: 'Giai đoạn 3: bài thực hành cách ly, không nhắm đến website hay hệ thống thật.',
  },
]
