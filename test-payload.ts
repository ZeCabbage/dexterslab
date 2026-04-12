import { RACES, CLASSES, BACKGROUNDS } from './dexterslab-frontend/app/dungeon-buddy/data/srd.ts';

const constraints = {
    races: RACES.map((r: any) => ({ id: r.id, subraces: r.subraces?.map((s: any) => s.id) || null })),
    classes: CLASSES.map((c: any) => ({ id: c.id, allowedSkills: c.skillChoices, numChoices: c.numSkillChoices })),
    backgrounds: BACKGROUNDS.map((b: any) => b.id)
};

console.log("Size of constraints payload: ", JSON.stringify(constraints).length);
