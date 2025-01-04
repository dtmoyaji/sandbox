import express from 'express';
import { Connection } from '../../models/connection.mjs';
import { Project } from '../../models/project.mjs';

const project_controller = express.Router();

project_controller.get('/keys/:key', async (req, res) => {
    try {
        let proj = new Project(new Connection());
        let project = await proj.getProject(req.params.key);
        //console.log("got project: " + project);
        res.json(project);
    } catch (err) {
        res.status(500).send('Error retrieving project'+err.message);
    }
});

project_controller.get('/all', async (req, res) => {
    try {
        let proj = new Project(new Connection());
        let projectList = await proj.getAllProjects();
        res.json(projectList);
    } catch (err) {
        res.status(500).send('Error retrieving projects'+err.message);
    }
});

export { project_controller };
