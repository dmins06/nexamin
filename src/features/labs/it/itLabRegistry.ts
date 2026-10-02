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
    status: 'beta',
    route: '/labs/it/computer',
    description:
      'Khám phá cách các thành phần máy tính phối hợp thực thi lệnh.',
    topics: ['CPU / RAM', 'Cache', 'Thanh ghi', 'Fetch–Decode–Execute'],
    next: 'Mô hình CPU giáo dục hoạt động; không mô tả đầy đủ vi kiến trúc thực.',
  },
  {
    id: 'network',
    title: 'Network Lab',
    icon: Network,
    status: 'beta',
    route: '/labs/it/network',
    description:
      'Xây dựng mạng mẫu và tìm hiểu vì sao một gói tin đến được đích.',
    topics: ['IP / Subnet', 'Router / Switch', 'Packet', 'TCP / IPv4'],
    next: 'Topology và packet mô phỏng; không gửi gói đến mạng thật.',
  },
  {
    id: 'os',
    title: 'Operating System',
    icon: Layers,
    status: 'beta',
    route: '/labs/it/os',
    description:
      'Thực nghiệm lập lịch CPU, quản lý bộ nhớ và tranh chấp tài nguyên.',
    topics: ['FCFS / SJF', 'Round Robin', 'Memory', 'Deadlock'],
    next: 'Timeline và chỉ số lập lịch, RAM và deadlock; dữ liệu độc lập hệ điều hành thật.',
  },
  {
    id: 'database',
    title: 'Database Lab',
    icon: Database,
    status: 'beta',
    route: '/labs/it/database',
    description:
      'Học SQL và quan hệ dữ liệu trên cơ sở dữ liệu thực hành riêng.',
    topics: ['SQL', 'JOIN', 'Index', 'ERD'],
    next: 'SQLite thật trong trình duyệt, tuyệt đối không kết nối database Nexamin.',
  },
  {
    id: 'ai',
    title: 'AI / Machine Learning',
    icon: BrainCircuit,
    status: 'beta',
    route: '/labs/it/ai',
    description:
      'Quan sát mô hình học từ dữ liệu và thay đổi dự đoán khi điều chỉnh tham số.',
    topics: ['Regression', 'KNN / KMeans', 'Decision Tree', 'Neural Network'],
    next: 'Năm mô hình nhỏ tính toán thật; không thay thế framework huấn luyện chuyên nghiệp.',
  },
  {
    id: 'security',
    title: 'Security Lab',
    icon: ShieldCheck,
    status: 'beta',
    route: '/labs/it/security',
    description:
      'Hiểu bảo mật qua mô hình giáo dục và cách phòng ngừa lỗi lập trình.',
    topics: ['Hash / Salt', 'Cryptography', 'Authentication', 'Secure Coding'],
    next: 'Web Crypto và chính sách demo, không nhắm đến website hay hệ thống thật.',
  },
]
