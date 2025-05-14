# SANDBOX-JS

SANDBOX-JS is a headless data management tool that automatically generates CRUD and RESTful APIs based on table definitions.

The automatically generated RESTful APIs can be accessed using JWT.

## Project Structure

The project is organized into the following main directories:

- `frontend/` - Frontend application built with Vue.js and TypeScript
  - `src/legacy-views/` - Views migrated from backend (transitional phase)
- `backend/` - Backend application (Node.js)
  - `views/` - Legacy view templates (being migrated to frontend)
    - `controls/centerPanel/` - Main panels for admin UI, now being modularized
      - Each panel (e.g. `tablePanel`, `queryPanel`, `scriptPanel`, etc.) is split into its own folder
      - Each folder contains EJS partials for views, scripts, and styles (e.g. `overviewView.ejs`, `script.ejs`, `style.ejs`, etc.)
- `postgresql/` - Database related files and configurations

## Migration Plan

The project is currently in a transitional phase with the following migration goals:

1. **View modularization & migration**  
   - EJS templates in `backend/views/controls/centerPanel/` are being split by panel and organized as partials (views, scripts, styles)
   - Status: In progress - Many panels have already been modularized into folders
   - Todo: Complete migration to `frontend/src/legacy-views/` and update backend references

2. **TypeScript migration**  
   - Converting JavaScript files to TypeScript
   - Status: In progress

## Project's goal

In server-side development, you often find yourself implementing similar procedures repeatedly for each service, such as login functionality, integration with external APIs, and master data maintenance. Before you can even begin implementing the core business logic, you need to perform these preparatory tasks, which are time-consuming, costly, and often tedious.

This project aims to provide a backend system that simplifies these tasks. It is developed with the following policies:

1. Use a single programming language from server-side to client-side. This makes it easier to understand the entire system.
1. Provide a mechanism for managing data table specifications.
1. Streamline screen development by dynamically generating a simple CRUD GUI.
1. Incorporate authentication processes and RESTful APIs to facilitate integration with external services.
1. Provide a mechanism to add and manage scripts as needed, allowing them to be executed at any time.

## Operating Environment

Runs in a docker + node.js environment. Supports creation of a PostgreSQL instance within docker.

## System behavior definitions

The important aspects of the system behavior definition are defined as workflows in each `.bpmn` file in the `documents` directory.
