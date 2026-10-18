"""Diagnostic HTTP : préserver l'erreur et ne pas divulguer les secrets."""
import io
import json
import unittest
from contextlib import redirect_stderr
from types import SimpleNamespace
from unittest.mock import Mock

from ffbb_import import diagnose_response, run_stage


class DiagnosticsTests(unittest.TestCase):
    def test_refusal_without_credentials_or_body(self):
        response = SimpleNamespace(
            status_code=403,
            url='https://user:password@api.ffbb.app/items/organismes/12343?access_token=SECRET',
            json=lambda: {'errors': [{'message': 'Bearer SECRET',
                                     'extensions': {'code': 'FORBIDDEN'}}],
                          'token': 'SECRET'})
        output = io.StringIO()
        with redirect_stderr(output):
            diagnose_response(response)
        event = json.loads(output.getvalue().removeprefix('[FFBB] '))
        self.assertEqual(event['codes'], ['FORBIDDEN'])
        self.assertEqual(event['status'], 403)
        self.assertEqual(event['url'], 'https://api.ffbb.app/items/organismes/12343')
        for secret in ('SECRET', 'password', 'Bearer', 'access_token'):
            self.assertNotIn(secret, output.getvalue())

    def test_html_refusal_and_success(self):
        output = io.StringIO()
        response = SimpleNamespace(status_code=403, url='https://api.ffbb.app/items/test',
                                   json=Mock(side_effect=ValueError('HTML SECRET')))
        with redirect_stderr(output):
            diagnose_response(response)
        self.assertIn('non-json', output.getvalue())
        self.assertNotIn('SECRET', output.getvalue())
        response.status_code = 200
        with redirect_stderr(io.StringIO()) as success:
            diagnose_response(response)
        self.assertEqual(success.getvalue(), '')

    def test_stage_preserves_exception_without_printing_message(self):
        error = RuntimeError('SECRET')
        with redirect_stderr(io.StringIO()) as output:
            with self.assertRaises(RuntimeError) as caught:
                run_stage('tokens', Mock(side_effect=error))
        self.assertIs(caught.exception, error)
        self.assertIn('stage_failed', output.getvalue())
        self.assertNotIn('SECRET', output.getvalue())
