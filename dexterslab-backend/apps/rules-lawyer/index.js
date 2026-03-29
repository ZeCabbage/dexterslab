import express from 'express';

export default class RulesLawyerApp {
  static manifest = {
    id: 'rules-lawyer',
    name: 'Rules Lawyer',
    target: 'pi',
    hardware: ['display'],
    wsPath: null,
    frontendRoute: '/observer/rules-lawyer',
    icon: '§',
    priority: 5
  };

  constructor(platform) {
    this.platform = platform;
  }

  getRoutes() {
    const router = express.Router();
    router.use((req, res) => {
      res.json({ error: 'Rules Lawyer is currently down for maintenance while platform stabilizes.' });
    });
    return router;
  }
}
