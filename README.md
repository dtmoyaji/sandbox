# SANDBOX-JS

SANDBOX-JS is a Headless Data Administration tool that automatically generates CRUD and RESTful APIs based on table definitions.

The automatically generated RESTful APIs can be accessed using JWT.

## Project Structure

The project is organized into the following main directories:

- `frontend/` - Frontend application built with Vue.js and TypeScript
  - `src/legacy-views/` - Views migrated from backend (transitional phase)
- `nodejs/` - Backend application (Node.js) - *Will be renamed to `backend/` in the future*
  - `views/` - Legacy view templates (being migrated to frontend)
- `postgresql/` - Database related files and configurations

## Migration Plan

The project is currently in a transitional phase with the following migration goals:

1. **Views Migration**: Moving view templates from backend to frontend
   - Status: In progress - Views copied to `frontend/src/legacy-views/`
   - Todo: Update backend references to use frontend components
   
2. **TypeScript Migration**: Converting JavaScript files to TypeScript
   - Status: In progress

## Project's goal

In server-side development, you often find yourself implementing similar procedures repeatedly for each service, such as login functionality, integration with external APIs, and master data maintenance. Before you can even begin implementing the core business logic, you need to perform these preparatory tasks, which are time-consuming, costly, and often tedious.

This project aims to provide a backend system that simplifies these tasks. It is developed with the following policies:

1. **Use a single programming language from server-side to client-side.** This makes it easier to understand the entire system.
1. **Provide a mechanism for managing data table specifications.**
1. **Streamline screen development by dynamically generating a simple CRUD GUI.**
1. **Incorporate authentication processes and RESTful APIs to facilitate integration with external services.**
1. **Provide a mechanism to add and manage scripts as needed, allowing them to be executed at any time.**

## Operating Environment

It operates in a docker + node.js environment. It supports the creation of a PostgreSQL instance within docker.

## system behavior definitions

The important aspects of the system behavior definition are defined in the workflows within each .bpmn file in sysdesign.
