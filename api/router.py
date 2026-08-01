"""Nautico API router — single Vercel Python function.

Vercel rewrites /api/billing/* to /api/router?route=billing/* (see
vercel.json), mirroring Yapply's setup. Only billing routes exist today.
"""

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from api.billing import (
  handle_billing_checkout,
  handle_billing_config,
  handle_billing_intent,
  handle_billing_status,
  handle_billing_webhook,
  _json_response,
)


def resolve_route(path: str) -> str:
  parsed = urlparse(path)
  route = parse_qs(parsed.query).get("route", [""])[0].strip("/")
  if route:
    return route
  return parsed.path.strip("/")


class handler(BaseHTTPRequestHandler):
  def do_OPTIONS(self):
    origin = self.headers.get("Origin", "").strip() if self.headers else ""
    self.send_response(HTTPStatus.NO_CONTENT)
    if origin:
      self.send_header("Access-Control-Allow-Origin", origin)
      self.send_header("Access-Control-Allow-Credentials", "true")
      self.send_header("Vary", "Origin")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.end_headers()

  def do_GET(self):
    route = resolve_route(self.path)

    if route == "billing/config":
      handle_billing_config(self)
      return

    _json_response(
      self,
      HTTPStatus.NOT_FOUND,
      {"ok": False, "code": "NOT_FOUND", "message": "The requested API route could not be found."},
    )

  def do_POST(self):
    route = resolve_route(self.path)

    if route == "billing/checkout":
      handle_billing_checkout(self)
      return

    if route == "billing/intent":
      handle_billing_intent(self)
      return

    if route == "billing/status":
      handle_billing_status(self)
      return

    if route == "billing/webhook":
      handle_billing_webhook(self)
      return

    _json_response(
      self,
      HTTPStatus.NOT_FOUND,
      {"ok": False, "code": "NOT_FOUND", "message": "The requested API route could not be found."},
    )
