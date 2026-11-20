import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const every6Hours = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: { name: 'Every 6 hours', parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } } }
});

const runFromDemo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'run-all', responseMode: 'onReceived', options: {} } }
});

const runLuma = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 01 Luma Germany',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'dkBBn1k8pGmdUqfv', cachedResultName: '01 Luma Germany -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runPinboard = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 02 LMU pinboard',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '6e9qbOQ2CzcjxVz3', cachedResultName: '02 LMU pinboard -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runTum = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 03 TUM Venture Labs',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rBvaaF23ZcfY1Hcd', cachedResultName: '03 TUM Venture Labs -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runGithub = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 05 GitHub Germany',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'Fg6ZU1fqi7JnRNu2', cachedResultName: '05 GitHub Germany -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runPodcasts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 06 Pitch podcasts',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'J0YCRvXE1fVlNsXT', cachedResultName: '06 Pitch podcasts -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runUni = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 07 University startups',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '938DWxWRYzIEvNNh', cachedResultName: '07 University startups Germany -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runIdw = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 08 Spin-off news',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '6ZlZePphuAyIfo90', cachedResultName: '08 Spin-off news (idw) -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runJobs = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 30 First hires',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '08C3DOx2nldpCt1i', cachedResultName: '30 First hires (job ads) -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runAcc = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 31 Accelerators',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'nHxaczLdIVLQzAC2', cachedResultName: '31 Accelerators and competitions -> Traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runDedupe = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 32 Remove duplicates',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'l8SnodVexcqO2HXs', cachedResultName: '32 Remove duplicate traces' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runWebsites = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 09 Find websites',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '3omXcLPOp5Y7i2pE', cachedResultName: '09 Find websites' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runLeads = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 10 Make leads',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'jLWKNwEC08SHfAfP', cachedResultName: '10 Make leads' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runTeam = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 34 Team enrichment',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'mBmYYUrE9a2OeHQ2', cachedResultName: '34 Team enrichment' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runScore = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 15 Score enriched leads',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '6fSUcccfgSt5h58T', cachedResultName: '15 Score leads' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const runCapital = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Run 33 Capital need',
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '4S7gTe3ofvnpIiz6', cachedResultName: '33 Capital need' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const howItWorks = sticky('## 00 Run all sources\nOne button for the whole engine: runs every source flow in turn (a broken source does not stop the others), then **09** finds company websites, then **10 Make leads** turns the new traces into leads.\nNew source flow? Add a **Called by Run all** trigger to it and one more Run step here. Only person 1 edits this flow.', [runLuma, runPinboard, runTum, runGithub, runPodcasts, runUni, runIdw, runJobs, runAcc, runDedupe, runWebsites, runLeads, runTeam, runScore, runCapital], { color: 7 });

export default workflow('run-all', '00 Run all sources')
  .add(runByHand)
  .to(runLuma)
  .to(runPinboard)
  .to(runTum)
  .to(runGithub)
  .to(runPodcasts)
  .to(runUni)
  .to(runIdw)
  .to(runJobs)
  .to(runAcc)
  .to(runDedupe)
  .to(runWebsites)
  .to(runLeads)
  .to(runTeam)
  .to(runScore)
  .to(runCapital)
  .add(every6Hours)
  .to(runLuma)
  .add(runFromDemo)
  .to(runLuma)
  .add(howItWorks)
  .group('Whole engine', [runLuma, runPinboard, runTum, runGithub, runPodcasts, runUni, runIdw, runJobs, runAcc, runDedupe, runWebsites, runLeads, runTeam, runScore, runCapital], { description: 'Every source, then Make leads, then 34 Team enrichment, 15 scores the enriched leads, then 33 Capital need. 04 Eventbrite is not in here' });
