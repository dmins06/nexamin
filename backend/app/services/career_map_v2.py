"""Career evidence and deterministic UTH elective-name mapping, version 2.

Employer pages describe fields of work, not guaranteed vacancies or outcomes.
Only imported UTH courses can be recommended. No credit or prerequisite is inferred.
"""

import re
from dataclasses import dataclass

from app.services.career_map_v1 import (
    CAREER_PATHS as TECH_CAREERS,
)
from app.services.career_map_v1 import (
    SKILL_LABELS as TECH_SKILL_LABELS,
)
from app.services.career_map_v1 import (
    course_skill_codes as tech_course_skill_codes,
)
from app.services.career_map_v1 import (
    fold,
)


@dataclass(frozen=True)
class CareerPath:
    code: str
    label: str
    skill_weights: tuple[tuple[str, int], ...]
    evidence_label: str
    evidence_url: str


@dataclass(frozen=True)
class SkillRule:
    code: str
    label: str
    pattern: str


SKILL_RULES: tuple[SkillRule, ...] = (
    SkillRule("supply_chain", "Chuỗi cung ứng", r"chuoi cung ung|supply chain|quan tri logistics|smart logistics"),
    SkillRule("freight", "Giao nhận và vận tải", r"giao nhan|van tai|freight|forwarding|vận tải|van chuyen|logistics"),
    SkillRule("port", "Khai thác cảng", r"cang bien|khai thac cang|port logistics|cang container|cang va"),
    SkillRule("warehouse_ops", "Kho và tồn kho", r"kho hang|quan ly kho|quan tri kho|ton kho|warehouse"),
    SkillRule("procurement", "Mua hàng", r"mua hang|thu mua|procurement|cung ung vat tu"),
    SkillRule("customs", "Hải quan và xuất nhập khẩu", r"hai quan|xuat nhap khau|thuong mai quoc te|ngoai thuong"),
    SkillRule("business", "Kinh doanh", r"kinh doanh|ban hang|marketing|khach hang|thi truong|thuong mai"),
    SkillRule("accounting", "Kế toán và chi phí", r"ke toan|kiem toan|tai chinh|chi phi|du toan|dinh gia"),
    SkillRule("project", "Quản lý dự án", r"quan ly du an|quan tri du an|quan ly xay dung|quan ly xd|quan ly thi cong|quan ly chat luong"),
    SkillRule("bim", "BIM và bản vẽ kỹ thuật", r"\bbim\b|autocad|revit|shop drawing|ban ve|thiet ke cong trinh"),
    SkillRule("structural", "Kết cấu công trình", r"ket cau|be tong|nha cao tang|cong trinh ngam|nen mong|suc ben vat lieu"),
    SkillRule("transport_civil", "Hạ tầng giao thông", r"cau duong|duong bo|cong trinh giao thong|giao thong thuy|duong sat"),
    SkillRule("site", "Thi công và giám sát", r"thi cong|giam sat|nghiem thu|an toan lao dong|cong truong"),
    SkillRule("real_estate", "Bất động sản", r"bat dong san|toa nha|van hanh toa nha|quan ly tai san"),
    SkillRule("interior", "Thiết kế nội thất", r"noi that|khong gian|trang tri|kien truc"),
    SkillRule("mechanical", "Cơ khí và thiết kế máy", r"co khi|thiet ke may|che tao may|may xep do|thiet bi xep do|\bcad\b|cam"),
    SkillRule("manufacturing", "Sản xuất và chất lượng", r"san xuat|gia cong|cong nghe che tao|quan ly chat luong|kiem dinh|kiem tra chat luong"),
    SkillRule("automation", "Điều khiển và tự động hóa", r"tu dong hoa|dieu khien|\bplc\b|scada|robot|cam bien|truyen thong cong nghiep|do luong dien"),
    SkillRule("embedded", "Hệ thống nhúng", r"nhung|vi dieu khien|iot|internet van vat|dieu khien dien tu"),
    SkillRule("electric", "Hệ thống điện", r"he thong dien|cung cap dien|luoi dien|dien cong nghiep|cao ap|truyen tai dien|dien tu cong suat|thiet bi dien|mang tiep xuc|dien giao thong|dien tu|dien nang"),
    SkillRule("renewable", "Năng lượng tái tạo", r"nang luong tai tao|dien gio|dien mat troi|nang luong sach|tiet kiem nang luong|kiem toan nang luong|he thong nhiet lanh"),
    SkillRule("vehicle", "Kỹ thuật ô tô", r"o to|dong co|he thong truyen luc|chan doan xe|bao duong xe|phuong tien giao thong dien"),
    SkillRule("ev", "Xe điện và pin", r"o to dien|xe dien|pin dien|pin lithium|he thong quan ly pin|nang luong moi"),
    SkillRule("ship", "Tàu thủy và công trình nổi", r"tau thuy|dong tau|cong trinh noi|than tau|ket cau tau|duong ong tau"),
    SkillRule("aircraft", "Kỹ thuật hàng không", r"hang khong|may bay|thiet bi bay|drone|uav"),
    SkillRule("environment", "Quản lý môi trường", r"moi truong|o nhiem|phat thai|chat thai|quan trac"),
    SkillRule("water", "Nước và xử lý nước", r"nuoc thai|cap thoat nuoc|xu ly nuoc|tai nguyen nuoc"),
    SkillRule("safety", "An toàn và HSE", r"an toan|hse|suc khoe nghe nghiep|phong chay|bao ho lao dong"),
    SkillRule("english", "Tiếng Anh chuyên ngành", r"tieng anh|anh ngu|english|bien phien dich|giao tiep lien van hoa"),
    SkillRule("translation", "Biên phiên dịch", r"bien dich|phien dich|dich thuat|ngon ngu anh"),
    SkillRule("digital_media", "Truyền thông số", r"truyen thong so|truyen thong da phuong tien|noi dung so|digital marketing|doi moi sang tao|phat trien san pham"),
    SkillRule("business_analysis", "Phân tích nghiệp vụ", r"phan tich nghiep vu|he thong thong tin quan ly|phan tich kinh doanh|he thong thong tin"),
    SkillRule("semiconductor", "Thiết kế vi mạch", r"vi mach|ban dan|asic|vlsi|chip|vi dien tu"),
)

SKILL_LABELS = {**TECH_SKILL_LABELS, **{rule.code: rule.label for rule in SKILL_RULES}}

BOSCH = ("Bosch Việt Nam – lĩnh vực công việc", "https://www.bosch.com.vn/careers/fields-of-work/")
VINFAST = ("VinFast – lĩnh vực kỹ thuật ô tô", "https://vinfastauto.com/vn_vi/tim-hieu-ve-nganh-cong-nghe-o-to")
GEMADEPT = ("Gemadept – hoạt động cảng và logistics", "https://www.gemadept.com.vn/dich-vu/port-logistics/")
COTECCONS = ("Coteccons – ví dụ công việc xây dựng", "https://www.coteccons.vn/opportunities/nhan-vien-shop-drawing/")
SAVILLS = ("Savills Việt Nam – công việc vận hành tòa nhà", "https://www.savills.com.vn/talk-to-us/careers/property-management-roles-on-site/hcmc-pm-vacancies/operation-manager.aspx")
CRYSTAL = ("Crystal Design TPL – thiết kế và thi công nội thất", "https://www.deco-crystal.com/thiet-ke-noi-that-showroom/")
UTH_ENGLISH = ("UTH – chương trình tiếng Anh và logistics", "https://iec.ut.edu.vn/vi/cu-nhan/chuong-trinh-100-tieng-anh/")
SGS = ("SGS Việt Nam – cơ hội nghề nghiệp", "https://www.sgs.com/vi-vn/our-company/co-hoi-nghe-nghiep-tai-sgs")
PTSC = ("PTSC – đóng tàu và công trình biển", "https://www.ptsc.com.vn/don-vi/cong-ty-lien-doanh-lien-ket/cong-ty-co-phan-che-tao-gian-khoan-dau-khi-pv-shipyard")


def path(code: str, label: str, skills: tuple[tuple[str, int], ...], source: tuple[str, str]) -> CareerPath:
    return CareerPath(code, label, skills, *source)


CAREER_PATHS: tuple[CareerPath, ...] = (
    *(CareerPath(item.code, item.label, item.skill_weights, *BOSCH) for item in TECH_CAREERS),
    path("data_analyst", "Chuyên viên phân tích dữ liệu", (("data", 3), ("sql", 2), ("visualization", 2), ("statistics", 2), ("business_analysis", 1)), BOSCH),
    path("supply_chain_planner", "Điều phối chuỗi cung ứng", (("supply_chain", 3), ("warehouse_ops", 2), ("procurement", 2), ("freight", 2), ("data", 1)), BOSCH),
    path("freight_forwarder", "Nhân viên giao nhận quốc tế", (("freight", 3), ("customs", 2), ("english", 2), ("port", 2), ("supply_chain", 1)), GEMADEPT),
    path("port_operations", "Vận hành cảng và terminal", (("port", 3), ("freight", 2), ("warehouse_ops", 2), ("safety", 1), ("project", 1)), GEMADEPT),
    path("procurement_specialist", "Chuyên viên mua hàng", (("procurement", 3), ("supply_chain", 2), ("business", 2), ("accounting", 1), ("english", 1)), BOSCH),
    path("business_analyst", "Chuyên viên phân tích nghiệp vụ", (("business_analysis", 3), ("data", 2), ("sql", 2), ("business", 2), ("project", 1)), BOSCH),
    path("digital_marketing", "Chuyên viên truyền thông số", (("digital_media", 3), ("business", 2), ("data", 1), ("visualization", 1), ("web", 1)), BOSCH),
    path("construction_site", "Kỹ sư thi công và giám sát", (("site", 3), ("structural", 2), ("project", 2), ("bim", 2), ("safety", 1)), COTECCONS),
    path("structural_design", "Kỹ sư thiết kế kết cấu", (("structural", 3), ("bim", 2), ("site", 1), ("project", 1)), COTECCONS),
    path("transport_infrastructure", "Kỹ sư công trình giao thông", (("transport_civil", 3), ("site", 2), ("structural", 2), ("bim", 2)), COTECCONS),
    path("construction_cost", "Kỹ sư dự toán / QS", (("accounting", 3), ("project", 2), ("bim", 2), ("site", 1), ("real_estate", 1)), COTECCONS),
    path("construction_manager", "Điều phối dự án xây dựng", (("project", 3), ("site", 2), ("bim", 1), ("accounting", 2), ("safety", 1)), COTECCONS),
    path("property_operations", "Vận hành bất động sản và tòa nhà", (("real_estate", 3), ("project", 2), ("business", 1), ("accounting", 1)), SAVILLS),
    path("interior_design", "Thiết kế nội thất", (("interior", 3), ("bim", 2), ("project", 1), ("business", 1)), CRYSTAL),
    path("mechanical_design", "Kỹ sư thiết kế cơ khí", (("mechanical", 3), ("manufacturing", 2), ("automation", 1), ("bim", 1)), BOSCH),
    path("manufacturing_engineer", "Kỹ sư sản xuất và chất lượng", (("manufacturing", 3), ("mechanical", 2), ("automation", 2), ("project", 1)), BOSCH),
    path("industrial_automation", "Kỹ sư tự động hóa công nghiệp", (("automation", 3), ("embedded", 2), ("electric", 2), ("manufacturing", 1)), BOSCH),
    path("power_systems", "Kỹ sư hệ thống điện", (("electric", 3), ("automation", 2), ("renewable", 1), ("safety", 1)), BOSCH),
    path("renewable_energy", "Kỹ sư năng lượng tái tạo", (("renewable", 3), ("electric", 2), ("automation", 1), ("project", 1)), BOSCH),
    path("automotive_engineer", "Kỹ sư kỹ thuật ô tô", (("vehicle", 3), ("mechanical", 2), ("manufacturing", 2), ("automation", 1)), VINFAST),
    path("electric_vehicle", "Kỹ sư hệ thống xe điện", (("ev", 3), ("vehicle", 2), ("electric", 2), ("embedded", 2)), VINFAST),
    path("ship_design", "Kỹ sư thiết kế và đóng tàu", (("ship", 3), ("mechanical", 2), ("structural", 1), ("bim", 1)), PTSC),
    path("aircraft_systems", "Kỹ sư hệ thống hàng không", (("aircraft", 3), ("mechanical", 2), ("automation", 2), ("embedded", 1)), BOSCH),
    path("environmental_engineer", "Kỹ sư môi trường", (("environment", 3), ("water", 2), ("safety", 2), ("project", 1)), SGS),
    path("hse_specialist", "Chuyên viên HSE", (("safety", 3), ("environment", 2), ("site", 1), ("manufacturing", 1)), SGS),
    path("technical_translation", "Biên phiên dịch chuyên ngành", (("translation", 3), ("english", 3), ("freight", 1), ("business", 1)), UTH_ENGLISH),
    path("international_logistics", "Điều phối logistics quốc tế", (("english", 2), ("freight", 3), ("customs", 2), ("supply_chain", 2)), UTH_ENGLISH),
    path("chip_design", "Kỹ sư thiết kế vi mạch", (("semiconductor", 3), ("embedded", 2), ("electric", 2), ("software", 1)), BOSCH),
)

CAREER_BY_CODE = {career.code: career for career in CAREER_PATHS}


def careers_for_program(major: str, specialization: str) -> tuple[CareerPath, ...]:
    """Explicit specialization-first routing; never offer every career to every major."""
    major_name, detail = fold(major.replace("đ", "d").replace("Đ", "D")), fold(specialization.replace("đ", "d").replace("Đ", "D"))
    codes: tuple[str, ...]
    if "ngon ngu anh" in major_name:
        codes = ("international_logistics", "technical_translation", "freight_forwarder")
    elif "mang may tinh" in major_name:
        codes = ("chip_design", "ai_engineer", "cybersecurity") if "vi mach" in detail else ("cybersecurity", "cloud_devops", "backend_engineer")
    elif "khoa hoc du lieu" in major_name:
        codes = ("data_scientist", "data_engineer", "ml_engineer", "ai_engineer")
    elif "he thong thong tin quan ly" in major_name:
        codes = ("business_analyst", "data_analyst", "data_engineer") if "kinh te so" not in detail else ("business_analyst", "data_scientist", "ai_engineer")
    elif "cong nghe thong tin" in major_name:
        if "o to so" in detail:
            codes = ("automotive_engineer", "electric_vehicle", "backend_engineer")
        elif "smart logistics" in detail:
            codes = ("supply_chain_planner", "business_analyst", "data_engineer")
        elif "truyen thong so" in detail:
            codes = ("digital_marketing", "fullstack_developer", "business_analyst")
        elif "khoa hoc du lieu" in detail:
            codes = ("data_scientist", "ai_engineer", "ml_engineer", "data_engineer")
        else:
            codes = ("backend_engineer", "fullstack_developer", "cybersecurity", "cloud_devops", "ai_engineer")
    elif "logistics" in major_name:
        codes = ("supply_chain_planner", "freight_forwarder", "port_operations", "procurement_specialist")
    elif "kinh te xay dung" in major_name:
        codes = ("property_operations", "construction_cost", "construction_manager") if "bat dong san" in detail else ("construction_cost", "construction_manager", "property_operations")
    elif "quan ly xay dung" in major_name:
        codes = ("construction_manager", "construction_cost", "construction_site")
    elif "moi truong" in major_name:
        codes = ("environmental_engineer", "hse_specialist")
    elif "tau thuy" in major_name:
        codes = ("ship_design", "manufacturing_engineer")
    elif "co khi" in major_name:
        if "hang khong" in detail:
            codes = ("aircraft_systems", "mechanical_design", "manufacturing_engineer")
        elif "logistics" in detail or "xep do" in detail:
            codes = ("mechanical_design", "port_operations", "manufacturing_engineer")
        else:
            codes = ("mechanical_design", "manufacturing_engineer", "industrial_automation")
    elif "o to" in major_name:
        codes = ("electric_vehicle", "automotive_engineer", "industrial_automation") if "dien" in detail else ("automotive_engineer", "electric_vehicle", "manufacturing_engineer")
    elif "dieu khien" in major_name:
        codes = ("aircraft_systems", "industrial_automation") if "bay" in detail else ("industrial_automation", "power_systems", "manufacturing_engineer")
    elif "ky thuat dien" in major_name:
        codes = ("renewable_energy", "power_systems", "industrial_automation") if "nang luong" in detail else ("power_systems", "industrial_automation", "renewable_energy")
    elif "xay dung" in major_name or "xay dung" in detail or "xay đung" in major_name:
        if "noi that" in detail:
            codes = ("interior_design", "construction_manager")
        elif "giao thong" in major_name or "cau duong" in detail or "duong bo" in detail or "cang" in detail:
            codes = ("transport_infrastructure", "construction_site", "construction_cost")
        else:
            codes = ("structural_design", "construction_site", "construction_cost")
    else:
        return ()
    return tuple(CAREER_BY_CODE[code] for code in codes)


def course_skill_codes(course_name: str) -> frozenset[str]:
    normalized = fold(course_name.replace("đ", "d").replace("Đ", "D"))
    return frozenset((*tech_course_skill_codes(course_name), *(rule.code for rule in SKILL_RULES if re.search(rule.pattern, normalized))))


def is_career_relevant_course(course_name: str) -> bool:
    normalized = fold(course_name.replace("đ", "d").replace("Đ", "D"))
    return not bool(re.search(r"the duc|quoc phong|quan su|bong |cau long|boi |vo vinam|vovinam|dien kinh|co vua|luan van|do an tot nghiep|thuc tap tot nghiep|khoa luan|hoc ky doanh nghiep|theo quy dinh cua truong|chuyen de tot nghiep", normalized))
