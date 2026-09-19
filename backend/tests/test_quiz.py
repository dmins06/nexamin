from app.models import QuestionType
from app.services.quizzes import answers_match, mastery_score


def test_quiz_grading_is_deterministic() -> None:
    assert answers_match(QuestionType.MULTIPLE_CHOICE, "K-Means", "  k-means ")
    assert not answers_match(QuestionType.TRUE_FALSE, "true", "false")
    assert mastery_score(8, 10) == 68.0
    assert mastery_score(0, 0) == 0.0
