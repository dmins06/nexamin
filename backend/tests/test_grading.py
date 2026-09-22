from app.services.grading import convert_score, degree_classification, policy_for


def test_hust_grade_conversion_uses_school_policy() -> None:
    policy = policy_for("BKA")
    assert policy.id == "hust-credit"
    assert convert_score(8.2, policy).letter == "B+"
    assert convert_score(8.2, policy).points == 3.5


def test_vnu_hanoi_grade_conversion_uses_37_scale() -> None:
    policy = policy_for("QHF")
    assert policy.id == "vnu-hanoi-credit"
    assert convert_score(8.7, policy).letter == "A"
    assert convert_score(8.7, policy).points == 3.7


def test_unknown_school_has_explicit_national_fallback() -> None:
    policy = policy_for("TST")
    assert policy.id == "moet-08-2021"
    assert convert_score(7.8, policy).points == 3.0
    assert degree_classification(3.6) == "Xuất sắc"
    assert degree_classification(None) == "Chưa đủ dữ liệu"


def test_national_fallback_matches_requested_grade_table() -> None:
    policy = policy_for("TST")
    assert convert_score(9.6, policy).letter == "A"
    assert convert_score(9.6, policy).points == 4.0
    assert convert_score(8.2, policy).letter == "B+"
    assert convert_score(8.2, policy).points == 3.5
    assert convert_score(7.4, policy).letter == "B"
    assert convert_score(7.4, policy).points == 3.0
    assert convert_score(6.7, policy).letter == "C+"
    assert convert_score(6.7, policy).points == 2.5
    assert convert_score(6.1, policy).letter == "C"
    assert convert_score(6.1, policy).points == 2.0
    assert convert_score(5.2, policy).letter == "D+"
    assert convert_score(5.2, policy).points == 1.5
    assert convert_score(4.2, policy).letter == "D"
    assert convert_score(4.2, policy).points == 1.0
    assert convert_score(3.9, policy).letter == "F"
    assert convert_score(3.9, policy).points == 0.0
