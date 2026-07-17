import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { createTeam, listTeams, updateTeam, deleteTeam, addMember, deleteMember } from '@/lib/services/teams';

afterAll(disconnect);

describe('teams service', () => {
  it('creates, lists, updates, deletes a team with members', async () => {
    const t = await createTeam({ name:'Test Team', code:'TT', tag:'demo' });
    expect(t.id).toBeTruthy();
    const m = await addMember(t.id, { name:'Alice', teamRole:'Lead' });
    let all = await listTeams();
    const found = all.find(x => x.id === t.id)!;
    expect(found.members.length).toBe(1);
    await updateTeam(t.id, { name:'Renamed' });
    all = await listTeams();
    expect(all.find(x=>x.id===t.id)!.name).toBe('Renamed');
    await deleteMember(m.id);
    await deleteTeam(t.id);
    all = await listTeams();
    expect(all.find(x=>x.id===t.id)).toBeUndefined();
  });
});
