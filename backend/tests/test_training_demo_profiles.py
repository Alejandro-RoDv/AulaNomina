import unittest
from types import SimpleNamespace
from app.crud.case_study import _demo_cases
from app.training.activity_mail_2026 import _body
from app.services.training_activity_runtime_service import _training_case_data

class TrainingDemoProfilesTest(unittest.TestCase):
    def test_full_profile_is_shared_by_mail_and_activity(self):
        case = next(item for item in _demo_cases() if item.scenario_code == "TRAIN-2026-001")
        profile = case.initial_state["employee_data"]
        self.assertEqual(case.initial_state["employee"], " ".join(profile[key] for key in ["first_name", "last_name", "second_last_name"]))
        self.assertNotIn("Fulanito", str(case.initial_state))
        digits = profile["dni"][:-1]
        self.assertEqual(profile["dni"][-1], "TRWAGMYFPDXBNJZSQVHLCKE"[int(digits) % 23])
        self.assertEqual(int(profile["naf"][-2:]), int(profile["naf"][:-2]) % 97)
        case.tasks = [SimpleNamespace(**task.model_dump(), id=index) for index, task in enumerate(case.tasks)]
        body = _body(case, "A04")
        self.assertIn("\n- Primer apellido: Ortega\n- Segundo apellido: Vidal", body)
        for key in ["dni", "naf", "domicile", "postal_code", "email", "mobile_phone"]:
            self.assertIn(profile[key], body)
        rows = _training_case_data(SimpleNamespace(case_study=case, trigger_condition={}), "A04", [])
        data = {row["label"]: row["value"] for row in rows}
        self.assertEqual(data["Segundo apellido"], profile["second_last_name"])
        self.assertEqual(data["DNI/NIE"], profile["dni"])

    def test_other_mail_has_separate_reference_data(self):
        task = SimpleNamespace(id=1, task_order=1, description="Revisar la nómina", title="Revisión", trigger_condition={"training_code": "A21", "case_facts": [{"label": "Periodo", "value": "2026-08"}]})
        case = SimpleNamespace(title="Nómina", description="Revisión mensual", tasks=[task], initial_state={"employee": "Natalia Castro Medina", "company_name": "Servicios Horizonte SL", "payroll_period": "2026-08"})
        body = _body(case, "A21")
        self.assertIn("Datos de referencia:\n- Persona trabajadora: Natalia Castro Medina", body)
        self.assertEqual(body.count("- Periodo: 2026-08"), 1)
        self.assertIn("\n\nQué tienes que hacer:\n", body)

    def test_existing_initial_mail_refresh_preserves_student_replies(self):
        import app.models
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session
        from app.db import Base
        from app.crud.case_study import seed_demo_case_studies
        from app.models.mail import Mailbox, EmailThread, EmailMessage
        from app.services.mail_service import _link_existing_demo_threads
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            seed_demo_case_studies(db)
            mailbox = Mailbox(role="student", display_name="Alumno demo", address="alumno@example.test")
            db.add(mailbox); db.flush()
            thread = EmailThread(mailbox_id=mailbox.id, case_reference="NOM-2026-014", subject="Revisión de Ana Martín", preview="Nómina de Ana Martín")
            db.add(thread); db.flush()
            initial = EmailMessage(thread_id=thread.id, sender_name="Administración de nóminas", sender_address="nominas@example.test", recipient_address=mailbox.address, body_text="La trabajadora Ana Martín solicita revisión.", direction="incoming", message_type="initial")
            reply = EmailMessage(thread_id=thread.id, sender_name="Alumno demo", sender_address=mailbox.address, recipient_address="nominas@example.test", body_text="He revisado a Ana Martín.", direction="outgoing", message_type="reply")
            db.add_all([initial, reply]); db.commit()
            _link_existing_demo_threads(db, mailbox)
            _link_existing_demo_threads(db, mailbox)
            self.assertEqual(initial.body_text, "La trabajadora Ana Martín García solicita revisión.")
            self.assertEqual(reply.body_text, "He revisado a Ana Martín.")
        engine.dispose()
