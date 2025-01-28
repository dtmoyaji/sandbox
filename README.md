# SANDBOX-JS

SANDBOX-JS is a Headless Data Administration tool that automatically generates CRUD and RESTful APIs based on table definitions.

The automatically generated RESTful APIs can be accessed using JWT.

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
