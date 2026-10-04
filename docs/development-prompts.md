# Key Development Prompts

This file records the key prompts used to guide Assignment 3 development.

## Supabase-backed authentication and requests

> Replace mock authentication and request data with Supabase Auth, profiles, equipment, rental requests, loans, FastAPI validation, and Row Level Security while preserving the ToolLoop interface.

## Admin request management

> Implement administrator login and dashboard workflows where verified admins can view, approve, or reject rental requests. Store reviewer metadata and ensure users see updated status in My Activity.

## Security and concurrency

> Enforce role checks in FastAPI, never trust frontend user IDs or roles, keep service-role credentials server-side, and make approval and return inventory changes atomic to prevent duplicate decisions and overbooking.

## Deployment audit

> Audit React, FastAPI, Supabase, RLS, environment variables, GitHub, and Vercel for Assignment 3. Fix only correctness, security, functionality, and compliance issues, then validate builds and tests.