import type { CodeLanguage, ProgrammingExercise } from './codeTypes'
export const languages: readonly {
  id: CodeLanguage
  title: string
  file: string
  note: string
}[] = [
  {
    id: 'python',
    title: 'Python',
    file: 'main.py',
    note: 'Python 3.11 · thư viện chuẩn, không pip hay network',
  },
  {
    id: 'c',
    title: 'C',
    file: 'main.c',
    note: 'Clang 8 / WASI · C chuẩn, không process hoặc socket',
  },
  {
    id: 'cpp',
    title: 'C++',
    file: 'main.cpp',
    note: 'Clang 8 / libc++ · không framework bên ngoài',
  },
  {
    id: 'java',
    title: 'Java',
    file: 'Main.java',
    note: 'Java 8 / Doppio · class Main, không package; tải đầu tiên khoảng 40 MB',
  },
  {
    id: 'javascript',
    title: 'JavaScript',
    file: 'main.js',
    note: 'QuickJS · console.log(), readline(), readAll(); không Node.js / DOM',
  },
]
const hello: Record<CodeLanguage, string> = {
  python: 'print("Hello World")\n',
  c: '#include <stdio.h>\nint main(void) {\n    puts("Hello World");\n    return 0;\n}\n',
  cpp: '#include <iostream>\nint main() {\n    std::cout << "Hello World\\n";\n    return 0;\n}\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}\n',
  javascript: 'console.log("Hello World");\n',
}
const sum: Record<CodeLanguage, string> = {
  python: 'a, b = map(int, input().split())\nprint(a + b)\n',
  c: '#include <stdio.h>\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) != 2) return 1;\n    printf("%d\\n", a + b);\n    return 0;\n}\n',
  cpp: '#include <iostream>\nint main() {\n    int a, b;\n    std::cin >> a >> b;\n    std::cout << a + b << "\\n";\n}\n',
  java: 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        int a = input.nextInt(), b = input.nextInt();\n        System.out.println(a + b);\n    }\n}\n',
  javascript:
    'const [a, b] = readline().trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n',
}
const template: Record<CodeLanguage, string> = {
  python: '# Đọc stdin và viết lời giải của bạn.\ntext = input()\n# TODO\n',
  c: '#include <stdio.h>\nint main(void) {\n    // TODO: đọc stdin và in kết quả\n    return 0;\n}\n',
  cpp: '#include <iostream>\n#include <vector>\nint main() {\n    // TODO: đọc stdin và in kết quả\n    return 0;\n}\n',
  java: 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // TODO: đọc stdin và in kết quả\n    }\n}\n',
  javascript:
    'const text = readAll();\n// TODO: xử lý dữ liệu rồi console.log kết quả\n',
}
export const exercises: readonly ProgrammingExercise[] = [
  {
    id: 'hello',
    title: 'Hello World',
    description:
      'In chính xác Hello World trên một dòng. Đây là ví dụ hoàn chỉnh để thử trình chạy.',
    difficulty: 'Nhập môn',
    languageTemplates: hello,
    testCases: [{ input: '', expectedOutput: 'Hello World', hidden: false }],
  },
  {
    id: 'sum',
    title: 'Tổng hai số',
    description:
      'Đọc hai số nguyên trên một dòng; in tổng. Ví dụ mẫu đã có lời giải để thử stdin. Các số có trị tuyệt đối ≤ 10⁶.',
    difficulty: 'Nhập môn',
    languageTemplates: sum,
    testCases: [
      { input: '3 4\n', expectedOutput: '7', hidden: false },
      { input: '-12 5\n', expectedOutput: '-7', hidden: false },
      { input: '0 0\n', expectedOutput: '0', hidden: false },
    ],
  },
  {
    id: 'prime',
    title: 'Số nguyên tố',
    description:
      'Đọc n (0 ≤ n ≤ 10⁶). In YES nếu n là số nguyên tố, NO nếu không. Gợi ý: kiểm tra ước đến căn bậc hai.',
    difficulty: 'Cơ bản',
    languageTemplates: template,
    testCases: [
      { input: '17\n', expectedOutput: 'YES', hidden: false },
      { input: '1\n', expectedOutput: 'NO', hidden: false },
      { input: '100\n', expectedOutput: 'NO', hidden: false },
    ],
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci',
    description:
      'Đọc n (0 ≤ n ≤ 30). In F(n), với F(0)=0, F(1)=1. Thử cách lặp để không tính lại.',
    difficulty: 'Cơ bản',
    languageTemplates: template,
    testCases: [
      { input: '0\n', expectedOutput: '0', hidden: false },
      { input: '1\n', expectedOutput: '1', hidden: false },
      { input: '10\n', expectedOutput: '55', hidden: false },
    ],
  },
  {
    id: 'binary',
    title: 'Binary Search',
    description:
      'Dòng 1: dãy số tăng dần, cách nhau bởi khoảng trắng. Dòng 2: giá trị cần tìm. In chỉ số từ 0 của lần xuất hiện đầu tiên, hoặc -1 nếu thiếu. Dãy tối đa 100 phần tử.',
    difficulty: 'Vận dụng',
    languageTemplates: template,
    algorithm: 'binary',
    testCases: [
      { input: '1 3 5 7 9\n7\n', expectedOutput: '3', hidden: false },
      { input: '2 2 2 4\n2\n', expectedOutput: '0', hidden: false },
      { input: '1 4 8\n2\n', expectedOutput: '-1', hidden: false },
    ],
  },
  {
    id: 'bubble',
    title: 'Bubble Sort',
    description:
      'Đọc một dòng số nguyên, tối đa 100 phần tử. Sắp xếp tăng dần bằng Bubble Sort, in dãy cách nhau bởi một khoảng trắng.',
    difficulty: 'Vận dụng',
    languageTemplates: template,
    algorithm: 'bubble',
    testCases: [
      { input: '5 2 8 1 4\n', expectedOutput: '1 2 4 5 8', hidden: false },
      { input: '3 -1 3 0\n', expectedOutput: '-1 0 3 3', hidden: false },
      { input: '7\n', expectedOutput: '7', hidden: false },
    ],
  },
]
export function isCodeLanguage(value: unknown): value is CodeLanguage {
  return languages.some((l) => l.id === value)
}
