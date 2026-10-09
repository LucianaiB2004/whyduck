import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Chat} from '../src/client/Chat';
import type {CaseRecord, User} from '../src/shared/types';

// Synthetic rendering fixture only: no model response or integration claim.
function renderCorrections(corrections?: number) {
  const record: CaseRecord = {
    id:'render-case',ownerId:'render-user',title:'校验透明度组件测试',merchant:'',product:'',amount:'',purchaseDate:'',request:'',category:'',status:'active',demo:true,factRevision:0,members:['butler'],facts:[],evidence:[],tasks:[],drafts:[],createdAt:'2026-10-08T00:00:00Z',updatedAt:'2026-10-08T00:00:00Z',
    messages:[{id:'message',role:'agent',agentId:'butler',content:'组件测试文字',citations:[],createdAt:'2026-10-08T00:00:00Z',mode:'demo',runId:'run'}],
    runs:[{id:'run',agentId:'butler',status:'completed',startedAt:'2026-10-08T00:00:00Z',tools:[],dependsOn:[],factRevision:0,validationCorrections:corrections}],
  };
  const user:User={id:'render-user',email:'render@example.test',name:'测试',aiConsent:true,createdAt:''};
  return renderToStaticMarkup(<Chat record={record} user={user} refresh={async()=>{}} mutate={async()=>true} go={()=>{}} notify={()=>{}} />);
}
describe('AI correction audit label (synthetic UI fixture)',()=>{
  it('shows corrections for the matching persisted run',()=>expect(renderCorrections(2)).toContain('校验纠正 2 次'));
  it('does not invent corrections when none occurred or count is absent',()=>{
    expect(renderCorrections(0)).not.toContain('校验纠正');
    expect(renderCorrections()).not.toContain('校验纠正');
  });
});
