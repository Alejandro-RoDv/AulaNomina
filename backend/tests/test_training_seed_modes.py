from app.services import mail_service


def test_mail_teaching_context_does_not_reset_training_workspace(monkeypatch):
    calls = []
    db = object()

    monkeypatch.setattr(mail_service, "seed_demo_student_groups", lambda value: calls.append(("groups", value)))
    monkeypatch.setattr(mail_service, "seed_demo_students", lambda value: calls.append(("students", value)))
    monkeypatch.setattr(mail_service, "seed_demo_case_studies", lambda value: calls.append(("cases", value)))

    def seed_assignments(value, *, reset_training_data=True):
        calls.append(("assignments", value, reset_training_data))

    monkeypatch.setattr(mail_service, "seed_demo_case_assignments", seed_assignments)

    mail_service._seed_demo_teaching_context(db)

    assert calls[:3] == [("groups", db), ("students", db), ("cases", db)]
    assert calls[3] == ("assignments", db, False)
