# Organic Brain Sandbox MVP
## Concept & Implementation Brief

## 1. プロジェクトの目的

このプロジェクトでは、一般的な人工ニューラルネットワークとは異なる、**生物の脳に近い局所活動・恒常性・オンライン学習・構造可塑性を持つ小規模な人工神経系**をTypeScriptで試作する。

最初から人間の知能やLLM代替を目指すものではない。

対象モデルとして、比較的単純な行動原理を持つ**昆虫レベルの人工生物**を想定する。

中心となる問いは次の通り。

> 固定された有限数のニューロンと、動的に変化するシナプス、内部の恒常性状態、局所的な学習だけから、餌・休息・生殖などの生存に必要な行動を自律的に獲得できるか。

通常のニューラルネットワークのように、

- 全ネットワークを毎回評価する
- 教師データを与える
- Lossを計算する
- Backpropagationする

という方式は採用しない。

代わりに、

- Event-driven
- Sparse activation
- Local learning
- Stateful neurons
- Synaptic plasticity
- Structural plasticity
- Homeostasis
- Neuromodulation
- Environment feedback

を中心にする。

---

# 2. 基本思想

このプロジェクトでは人工生命を、

```text
Environment
    ↓
Sensors
    ↓
Neural Network
    ↓
Actions
    ↓
Environment changes
    ↓
Body state changes
    ↓
Neuromodulation / Homeostasis
    ↓
Neural Network changes
```

という閉ループ系として扱う。

重要なのは、

> 「正しい行動」をプログラムしない

ことである。

例えば餌について、

```text
food = good
```

という知識を直接ネットワークへ与えてはいけない。

代わりに、

```text
餌を食べる
↓
energy が回復する
hunger が低下する
↓
homeostatic error が改善する
↓
直前に活動した神経経路が強化される
```

という因果関係から学習させる。

ネットワークは結果として、

> 特定の刺激と行動系列が、自分の内部状態を改善する

ことを獲得する。

---

# 3. MVPの範囲

MVPでは以下だけを実装する。

### Neural system

- 固定数ニューロン
- Excitatory / Inhibitory neuron
- 固定されたニューロン位置
- 動的シナプス
- Spike / event driven execution
- STDP
- Homeostasis
- Structural plasticity
- Neuromodulation
- Energy budget

### Artificial organism

- Hunger
- Energy
- Fatigue
- Mating drive
- Alive / dead

### Environment

- Food
- Mate
- Shelter
- Danger
- Empty terrain

### Actions

- Move forward
- Turn left
- Turn right
- Eat
- Rest
- Mate

### Observation UI

- 2D environment
- Neural activity visualization
- Active synapses
- Neuron heatmap
- Internal body state
- Neuromodulator state
- Timeline
- Inspector
- Pause / Step / Speed control

---

# 4. ベースプロジェクト

以下をベースとする。

https://github.com/ugnoguchigxp/hono-standard

既存構造をできるだけ維持すること。

Brain RuntimeはHonoやReactから独立した**pure TypeScript module**として実装する。

将来的に、

- Web UI
- CLI
- Worker
- Benchmark
- Wasm
- 他プロジェクト

から利用できる構造にする。

---

# 5. 推奨ディレクトリ構造

```text
api/
  app/
  routes/
    brain.route.ts
    experiment.route.ts

  brain/
    core/
      neuron.ts
      synapse.ts
      network.ts
      types.ts

    runtime/
      brain-runtime.ts
      event-queue.ts
      scheduler.ts
      clock.ts

    plasticity/
      stdp.ts
      homeostasis.ts
      structural-plasticity.ts
      intrinsic-plasticity.ts

    modulation/
      modulator-state.ts
      modulator-runtime.ts

    topology/
      generator.ts
      spatial-index.ts
      connection-policy.ts

    organism/
      organism.ts
      body-state.ts
      drives.ts
      metabolism.ts
      sensors.ts
      actuators.ts

    environment/
      world.ts
      cell.ts
      entities.ts
      interaction.ts

    experiment/
      experiment.ts
      scenario.ts
      metrics.ts

    observation/
      telemetry.ts
      snapshot.ts
      recorder.ts

shared/
  schemas/
    brain.schema.ts
    experiment.schema.ts
    telemetry.schema.ts

web/
  features/
    world/
      WorldView.tsx
      AgentLayer.tsx

    brain/
      BrainView.tsx
      NeuronLayer.ts
      SynapseLayer.ts
      HeatmapLayer.ts
      NeuronInspector.tsx

    organism/
      BodyStatePanel.tsx
      ModulatorPanel.tsx

    experiment/
      ExperimentControls.tsx
      Timeline.tsx
      MetricsPanel.tsx
```

---

# 6. ニューロンの基本ルール

MVPではニューロン数は固定する。

例:

```text
Neuron count = 1000
Excitatory = 80%
Inhibitory = 20%
```

重要な制約:

```text
Neuron count       = fixed
Neuron creation    = prohibited
Neuron deletion    = prohibited

Neuron position    = fixed
Neuron type        = fixed

Synapse creation   = allowed
Synapse deletion   = allowed
Synapse weight     = dynamic
Neuron threshold   = slowly dynamic
```

生物脳そのものを忠実に再現する必要はない。

目的は、

> 有限資源の中でネットワークがどう自己組織化するか

を観察することである。

---

# 7. Neuron

単なるactivation functionとして扱わない。

各Neuronは内部状態を持つ。

概念例:

```ts
interface Neuron {
  id: number

  type: "excitatory" | "inhibitory"

  x: number
  y: number

  potential: number
  restingPotential: number
  threshold: number

  refractoryUntil: number

  lastSpikeAt?: number

  activityAverage: number
  excitability: number

  modulatorSensitivity: {
    reward: number
    threat: number
    novelty: number
    arousal: number
  }
}
```

Neuron自身へ学習アルゴリズムを埋め込みすぎないこと。

```text
Neuron = State
PlasticityRule = State transition
Runtime = Event processing
```

という分離を維持する。

---

# 8. Synapse

概念例:

```ts
interface Synapse {
  id: number

  from: number
  to: number

  type: "excitatory" | "inhibitory"

  weight: number
  delayMs: number

  preTrace: number
  postTrace: number

  usage: number
  age: number

  plasticity: number
}
```

シナプス総数には制限を設ける。

例:

```text
maxOutgoingSynapsesPerNeuron = 32
```

または、

```text
globalSynapseBudget = 20,000
```

を設定する。

新しい接続を作るために古い接続を失うことがあり得る構造にする。

---

# 9. 空間制約

ニューロンは2Dまたは疑似3D上に固定配置する。

接続コストは距離依存とする。

概念:

```text
P(connect) ∝ exp(-distance / lambda)
```

近距離接続は形成されやすく、長距離接続は高コストとする。

目的は自然な局所クラスタ形成を促すこと。

---

# 10. Event-driven Runtime

全Neuronを毎tick更新してはいけない。

基本設計:

```text
Spike
↓
Event Queue
↓
関連するSynapse
↓
Target Neuron update
↓
Threshold crossed
↓
New Spike
```

イベントが発生した局所だけを更新する。

概念:

```ts
interface SpikeEvent {
  at: number
  source: number
  target: number
  strength: number
}
```

これは本プロジェクトの重要な設計原則である。

---

# 11. STDP

Backpropagationは使わない。

局所的なSpike timingだけからSynapseを変化させる。

概念:

```text
A spike
↓ 5ms
B spike

A → B strengthened
```

逆方向または時間差が大きい場合は弱化する。

STDPルールはstrategyとして差し替え可能にする。

---

# 12. Structural Plasticity

WeightだけではなくGraphそのものを変える。

### Synapse creation

例えば、

- 近距離
- 同時活動
- activity correlation
- 未接続

などを条件に接続生成候補とする。

### Synapse pruning

以下のようなものを削除候補とする。

- 長期間使用されない
- Weightが極端に弱い
- Energy costに見合わない
- Synapse budget超過

目的は、

```text
Random initial network
↓
Experience
↓
Local clusters
↓
Specialized circuits
```

を発生させること。

---

# 13. Homeostasis

各Neuronは活動量を一定範囲に保とうとする。

例:

```text
too active
→ threshold ↑

not active enough
→ threshold ↓
```

ただしHomeostasisの目標値は完全固定ではなく、後述するNeuromodulationによって変化可能とする。

---

# 14. Neuromodulation

MVPでは生物学的ホルモンを完全再現しない。

以下の抽象状態を持たせる。

```ts
interface ModulatorState {
  reward: number
  threat: number
  novelty: number
  arousal: number
}
```

これらは行動命令ではない。

例えば、

```text
threat high
→ sensory sensitivity change
→ learning rate change
→ inhibition change
→ target activity change
```

のように、

> ネットワークの動作条件を変更する

ためだけに使用する。

絶対に、

```text
threat high
→ move left
```

のような直接行動ルールにはしない。

---

# 15. 時間スケール

最低でも以下を分離する。

```text
Fast
milliseconds
Spike / membrane potential

Medium
seconds
Neuromodulators

Slow
minutes+
Homeostasis
Synaptic adaptation
Structural plasticity
```

将来的には、

```text
Very slow
hours / days
baseline sensitivity
long-term adaptation
```

も追加できるようにする。

---

# 16. Artificial Organism

昆虫程度の人工生物をモデルとする。

Body state:

```ts
interface BodyState {
  energy: number
  hunger: number
  fatigue: number
  matingDrive: number

  alive: boolean
}
```

値は基本的に0..1。

時間経過で自然劣化する。

例:

```text
energy ↓
hunger ↑
fatigue ↑
matingDrive ↑
```

---

# 17. Homeostatic Setpoint

人工生物は「快適な身体状態」を持つ。

例:

```ts
const homeostaticSetpoint = {
  energy: 0.8,
  hunger: 0.2,
  fatigue: 0.2,
  matingDrive: 0.1,
}
```

現在状態との差を、

```text
homeostatic error
```

として扱う。

重要なのは、

```text
Food = reward
```

とはしないこと。

代わりに、

```text
Food eaten
↓
Energy improves
↓
Hunger decreases
↓
Homeostatic error decreases
↓
Positive modulation
```

とする。

---

# 18. Death

死亡をMVPから実装する。

例:

```text
energy <= 0
→ starvation death
```

または将来、

```text
danger interaction
→ predation
```

なども可能。

死んだ個体の学習済みSynapseや経験を次個体へ持ち越してはいけない。

```text
Individual memory
→ dies with organism
```

とする。

「死に戻り学習」は禁止する。

---

# 19. Initial Conditions / Innate Prior

完全な白紙では学習成立が難しい可能性があるため、最低限の生得的priorを与える。

ただし、

```text
food = good
```

を直接教えてはいけない。

候補:

- food-like chemicalへの弱いattention bias
- danger-like signalへの弱いavoidance bias
- shelter-like signalへの弱いbias
- mating signalへの弱いbias
- sensor sensitivity
- plasticity rule
- homeostatic setpoint

これらは、

```text
DNA-like initial parameters
```

として扱う。

---

# 20. Initial Feeding

最初の個体には学習を開始しやすい条件を与えてよい。

例えば、

```text
birth
↓
moderately hungry
↓
food placed nearby
↓
agent accidentally reaches food
↓
body state improves
↓
first successful plasticity event
```

とする。

つまり、

> 最初の成功体験を得やすくする

ことは許可する。

しかし、学習済みシナプスを直接注入しない。

---

# 21. Environment

2D gridまたは連続2D空間。

MVPでは以下を配置する。

```text
Food
Mate
Shelter
Danger
Empty terrain
```

Agentへ直接オブジェクト種類を入力しない。

例えば、

```text
Food exists at (x, y)
```

をNNへ渡してはいけない。

---

# 22. Sensor Layer

昆虫的な曖昧なSensorを使用する。

例:

```text
chemical-left
chemical-right

mate-signal-left
mate-signal-right

danger-signal

light

shelter-signal

touch
```

NNには、

```text
chemical-left = 0.72
chemical-right = 0.31
```

などだけ渡す。

Agentは「Food」という概念を知らない。

---

# 23. Drive Input

Body stateもNetwork入力の一部とする。

例えば、

```text
hunger
fatigue
matingDrive
energy
```

同じSensor inputでも内部状態によって反応が変化できる構造にする。

例:

```text
food signal
+
low hunger
→ weak response

food signal
+
critical hunger
→ strong response
```

ただしこの結果をif文で作らない。

NeuromodulationとNeural activityから生じること。

---

# 24. Actions

MVP:

```text
move_forward
turn_left
turn_right
eat
rest
mate
```

Action自体に成功保証を持たせない。

例:

```text
eat
```

を実行しても近くにFoodがなければ何も起こらない。

```text
rest
```

もShelter以外では回復率が低い、または危険を伴う。

これによって環境との因果関係を学習させる。

---

# 25. Food

Food tileへ到達し、Eat actionが成功すると、

```text
energy ↑
hunger ↓
```

Foodそのものにはrewardを設定しない。

身体状態改善からreward相当のModulationを導出する。

---

# 26. Shelter

ShelterではRest actionの効率が高い。

例えば、

```text
normal terrain:
fatigue recovery = low

shelter:
fatigue recovery = high
danger probability = low
```

これにより、

> 疲れたら安全な場所まで移動して休む

という行動が学習可能かを観察する。

---

# 27. Mate

Mating driveは時間経過で上昇する。

Mate signalをSensorとして入力。

近距離でMate actionが成功すると、

```text
matingDrive ↓
```

する。

MVPでは実際の子個体生成は必須ではない。

まずはdrive解消まででよい。

---

# 28. Energy Budget

Network activity自体にもコストを持たせる。

例:

```text
spike cost
synapse transmission cost
long-distance transmission cost
movement cost
```

これらがBody energyを消費する。

つまり、

> 思考・知覚・移動そのものにも代謝コストがある

状態にする。

目的はSparse activationを自然に有利にすること。

---

# 29. UI — World

画面中央または左中央に2D Worldを表示する。

表示:

- Agent
- Food
- Mate
- Shelter
- Danger

Agentのsensor rangeなどもoptionalで表示可能とする。

---

# 30. UI — Neural Map

Neural Mapは固定座標で表示する。

Neuron位置は動かさない。

表示モード:

### Activity heatmap

最近の発火頻度。

### Membrane potential

Thresholdへの近さ。

### Plasticity

最近どれだけ学習・変化したか。

### Modulation sensitivity

特定modulatorへの感受性。

---

# 31. Active Synapse Visualization

全Synapseを常時描画しない。

デフォルトでは、

```text
recently active synapses
```

だけを描画する。

例えば直近100ms。

表示切替:

- Active
- Strong
- Recently strengthened
- Recently weakened
- Newly created
- About to prune

線の太さはWeightに対応させる。

---

# 32. Inspector

Neuronクリック時:

```text
Neuron #431

type
potential
threshold
activity average

incoming synapses
outgoing synapses

reward sensitivity
threat sensitivity
novelty sensitivity
arousal sensitivity

last spike
```

Synapseクリック時:

```text
Synapse #812

source
target

weight
delay

usage
age

pre trace
post trace

last plasticity delta
```

内部状態を完全に観察可能にする。

---

# 33. Body State UI

常時表示する。

例:

```text
Hunger
████████░░ 0.82

Energy
███░░░░░░░ 0.31

Fatigue
██████░░░░ 0.61

Mating drive
████░░░░░░ 0.39

Alive
YES
```

---

# 34. Timeline

最低限以下を時系列表示する。

```text
Stimulus
Body state
Modulator state
Spike activity
Synapse creation
Synapse pruning
Homeostatic error
Action
```

因果関係を人間が観察できることが重要。

---

# 35. Simulation Control

必須:

```text
Run
Pause
Single Step
Reset

x0.1
x1
x10
x100
```

Random seedも指定可能にする。

同じSeedとConfigなら可能な範囲で再現可能にする。

---

# 36. Rendering

React DOMへNeuron stateを大量に流さないこと。

推奨:

```text
React
→ controls / inspector / panels

Canvas 2D
→ neural activity
→ synapses
→ environment
```

MVPはCanvas 2Dでよい。

数千〜数万Neuron規模へ進んだ場合のみWebGLを検討する。

---

# 37. Telemetry

Simulation runtimeからUIへはbatch telemetryを送る。

1 spike = 1 JSON message

にはしないこと。

例:

```ts
type BrainTelemetry =
  | SpikeBatch
  | NeuronActivityBatch
  | SynapseChangeBatch
  | OrganismState
  | MetricBatch
```

SSEまたはWebSocketを使用可能。

MVPではSSE優先でよい。

---

# 38. Persistence

全SpikeをSQLiteへ保存しない。

保存対象:

```text
Experiment config
Seed
Initial topology
Periodic snapshots
Aggregated metrics
Final topology
Final organism state
```

Raw activityはmemory bufferまたはoptional recording fileとする。

---

# 39. 最初に実施するExperiment

## Experiment 1 — Food learning

条件:

- Hungry agent
- Food nearby
- No danger

観察:

- Food signalへ向かう経路が形成されるか
- Eat action成功率が上昇するか
- Synapse clusterが形成されるか

---

## Experiment 2 — Shelter learning

条件:

- Fatigue increases
- Shelter recovers fatigue efficiently

観察:

> 疲労時にShelterへ移動してRestする行動が形成されるか。

---

## Experiment 3 — Mating

条件:

- Mating drive increases
- Mate emits signal

観察:

> 内部driveによってMate signalへの反応が変化するか。

---

## Experiment 4 — Competing drives

例:

```text
hunger = high
fatigue = high
matingDrive = high
```

Environment:

```text
Food
Mate
Shelter
```

観察:

> 中央ルールなしで、どの行動を優先するか。

---

## Experiment 5 — Risk

FoodをDanger領域の近くに置く。

観察:

```text
low hunger
→ danger avoidance

critical hunger
→ risk taking?
```

のようなDrive間競合が創発するか。

この行動をハードコードしない。

---

# 40. MVP成功条件

MVPでは「賢い」必要はない。

以下が確認できれば成功とする。

### Condition A

Randomな初期Networkから、環境との相互作用によってSynapse weightsが変化する。

### Condition B

Synapse topologyそのものが変化する。

### Condition C

特定刺激に対して再現可能な局所活動patternが形成される。

### Condition D

Body stateの違いによって、同じ外部刺激への反応が変化する。

### Condition E

Food / RestなどによるHomeostatic improvementを利用して行動傾向を獲得する。

### Condition F

Network内部の変化をUIから追跡・説明できる。

---

# 41. 非目標

MVPでは以下を実装しない。

- Human brain simulation
- LLM
- Language
- Backpropagation
- Transformer
- Gradient descent
- 高度な認知
- Consciousness
- Emotion label
- DNA simulation
- Hormone biology full simulation
- Glia
- Gene expression
- Epigenetics
- Multi-generation evolution
- Reproduction inheritance
- GPU optimization

これらはMVPで扱わない。

---

# 42. 実装上の重要原則

### 1. Behaviourをハードコードしない

禁止:

```ts
if (hunger > 0.8) {
  moveToward(food)
}
```

### 2. Foodを概念としてNetworkへ入力しない

禁止:

```ts
input.foodDetected = true
```

代わりに曖昧なSensor値を使用する。

### 3. 外部Rewardを可能な限り使用しない

Reward相当は、

```text
homeostatic improvement
```

から導出する。

### 4. Network stateとLearning ruleを分離する

実験的に差し替え可能にする。

### 5. Determinismを重視する

Seedを保存する。

### 6. 内部状態を観察可能にする

Debuggability / inspectabilityを重視する。

---

# 43. このMVPで検証したい仮説

本プロジェクトの中心仮説は以下。

> 固定された有限数のニューロンと、局所的なイベント駆動計算、シナプス可塑性、構造可塑性、恒常性、内部driveだけでも、単純な生存行動を学習するネットワークが自己組織化する可能性がある。

さらに、

> Intelligenceを最大化するのではなく、有限なEnergyと有限なNetwork capacityの中でHomeostasisを維持させることによって、Sparseで局所的な有用回路が自然形成される可能性がある。

を検証する。

---

# 44. コンセプト上の位置付け

これは通常のMachine Learning modelではない。

より近い表現は、

> **育成可能で観察可能な人工神経組織**

である。

モデルをTrainingしてFreezeするのではなく、

```text
birth
↓
experience
↓
local plasticity
↓
structural change
↓
behaviour
↓
environment feedback
↓
further adaptation
```

という継続的プロセスとして扱う。

最終的には、LLMを置き換えるものではなく、

- 自律制御
- 常時稼働Sensor processing
- anomaly detection
- adaptive routing
- robot behaviour
- ambient AIの低レベル状態管理

などの局所的用途へ展開できる可能性も検討する。

ただしMVPでは用途適用よりも、

**何が自然に創発するのかを観察できる実験環境を完成させること**

を最優先とする。