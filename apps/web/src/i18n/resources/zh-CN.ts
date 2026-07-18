export const zhCN = {
  app: {
    loading: '应用加载中...',
    teamLoadFailed: '团队信息加载失败',
    accessLoadFailed: '权限信息加载失败',
    noAvailableTeam: '当前账号没有可用团队'
  },
  common: {
    actions: {
      refresh: '刷新',
      back: '返回',
      save: '保存',
      cancel: '取消',
      confirmDelete: '确认删除',
      retry: '刷新后重试'
    },
    states: {
      loading: '加载中...',
      saving: '保存中...',
      deleting: '删除中...'
    },
    fallback: {
      currentUser: '当前用户',
      emptyValue: '-'
    }
  },
  apiErrors: {
    codes: {
      'auth.user_not_logged_in': '当前登录状态已失效，请重新登录。',
      'auth.missing_authorization_header': '当前登录状态已失效，请重新登录。',
      'auth.invalid_authorization_token': '当前登录凭证无效，请重新登录。',
      'auth.organization_identifier_missing':
        '当前登录凭证缺少组织信息，请重新登录。',
      'auth.team_uuid_required': '缺少团队上下文，请重新选择团队后重试。',
      'auth.selected_team_not_accessible':
        '当前选择的团队不可访问，请重新选择团队后重试。',
      'access.not_app_member':
        '当前账号不是当前团队的 AI 工作流成员，请联系管理员添加。',
      'access.admin_only': '当前页面仅管理员可访问。',
      'common.internal_server_error': '服务内部错误，请稍后重试。',
      'common.route_not_found': '请求的接口不存在。',
      'skills.invalid_payload': '技能请求参数无效。',
      'skills.invalid_package_payload':
        '技能包内容无效，请检查目录结构和 SKILL.md。',
      'skills.uuid_required': '缺少技能标识。',
      'skills.version_invalid': '技能版本号无效。',
      'skills.not_found': '未找到对应的技能。',
      'skills.conflict': '已存在同名技能，请修改后重试。',
      'skills.in_use': '该技能仍被 Agent 引用，暂时不能删除。',
      'agent_clients.invalid_connect_payload':
        'Agent Client 连接请求参数无效。',
      'agent_clients.invalid_connect_poll_payload':
        'Agent Client 轮询请求参数无效。',
      'agent_clients.invalid_connection_request':
        'Agent Client 连接请求已失效，请重新发起连接。',
      'agent_clients.uuid_required': '缺少 Agent Client 标识。',
      'agent_clients.not_found': '未找到对应的 Agent Client。',
      'executions.dispatched_issue_uuid_required': '缺少工作项执行记录标识。',
      'executions.dispatched_issue_not_found': '未找到对应的工作项执行记录。',
      'executions.issue_execution_history_uuid_required': '缺少执行历史标识。',
      'executions.issue_execution_history_not_found': '未找到对应的执行历史。',
      'executions.issue_agent_execution_history_uuid_required':
        '缺少 Agent 执行历史标识。',
      'executions.issue_agent_execution_history_not_found':
        '未找到对应的 Agent 执行历史。',
      'executions.issue_agent_execution_retry_not_allowed':
        '当前 Agent 执行记录不允许重置，请刷新后重试。',
      'workflows.uuid_required': '缺少工作流标识。',
      'workflows.invalid_payload': '工作流请求参数无效。',
      'workflows.not_found': '未找到对应的工作流。',
      'workflows.node_uuid_required': '缺少执行节点标识。',
      'workflows.invalid_node_payload': '执行节点请求参数无效。',
      'workflows.node_not_found': '未找到对应的执行节点。',
      'workflows.node_executor_invalid':
        '工作流节点绑定的执行 Agent 配置无效。',
      'workflows.deletion_blocked':
        '工作流下仍有执行节点，请先删除执行节点后再删除工作流。',
      'agents.invalid_payload': 'Agent 请求参数无效。',
      'agents.invalid_prompt_preview_payload': '提示词预览请求参数无效。',
      'agents.invalid_prompt_recommendation_payload':
        '推荐提示词请求参数无效。',
      'ai_model_config.not_configured': '管理员尚未配置 AI 模型。',
      'ai_model_config.unsafe_base_url': '模型地址不符合公网 HTTPS 安全要求。',
      'skill_generation.revision_conflict':
        'Skill 草稿已发生变化，请刷新后重试。',
      'skill_generation.script_review_required': '请先确认已审核生成脚本。',
      'agents.invalid_draft_payload': 'Agent 草稿请求参数无效。',
      'agents.invalid_publish_payload': 'Agent 发布请求参数无效。',
      'agents.workspace_binding_not_found': 'Agent 绑定的工作区不存在。',
      'agents.skill_binding_not_found': 'Agent 绑定的技能不存在。',
      'agents.knowledge_binding_not_found': 'Agent 绑定的知识源不存在。',
      'agents.wiki_write_target_required':
        '关联 Wiki 页面输出必须配置写入页面组。',
      'agents.conflict': 'Agent 数据存在冲突，请刷新后重试。',
      'agents.uuid_required': '缺少 Agent 标识。',
      'agents.not_found': '未找到对应的 Agent。',
      'agents.draft_not_found': '当前 Agent 还没有可发布的草稿配置。',
      'agents.in_use': '该 Agent 仍被工作流引用，暂时不能删除。',
      'members.invalid_payload': '成员请求参数无效。',
      'members.conflict': '该成员已存在。',
      'members.user_uuid_required': '缺少成员用户标识。',
      'members.not_found': '未找到对应成员。',
      'ones.config_error': 'ONES 集成配置异常，请联系管理员检查配置。',
      'ones.request_error': '请求 ONES 服务失败，请稍后重试。',
      'ones.response_error': 'ONES 服务返回了不可处理的数据，请稍后重试。',
      'ones.invalid_user_search_query': 'ONES 用户搜索参数无效。',
      'agent_workspaces.invalid_payload': '工作区请求参数无效。',
      'agent_workspaces.uuid_required': '缺少工作区标识。',
      'agent_workspaces.not_found': '未找到对应的工作区。',
      'agent_workspaces.in_use': '该工作区仍被 Agent 引用，暂时不能删除。',
      'agent_workspaces.auth_conflict':
        '当前工作区认证配置与操作不兼容，请先调整认证配置。',
      'agent_workspaces.repository_uuid_required': '缺少代码仓标识。',
      'agent_workspaces.invalid_repository_payload': '代码仓请求参数无效。',
      'agent_workspaces.repository_not_found': '未找到对应的代码仓。',
      'agent_workspaces.invalid_auth_payload': '工作区认证参数无效。',
      'agent_workspaces.invalid_credential_payload': '工作区凭证参数无效。',
      'agent_workspaces.credential_env_name_required': '缺少凭证环境变量名。',
      'agent_workspaces.credential_not_found': '未找到对应的工作区凭证。',
      'knowledge_sources.invalid_payload': '知识源请求参数无效。',
      'knowledge_sources.not_found': '未找到对应的知识源或 Wiki 页面组。',
      'knowledge_sources.conflict': '该知识源已存在或仍被 Agent 引用。'
    }
  },
  language: {
    label: '语言',
    options: {
      'zh-CN': '简体中文',
      'en-US': 'English',
      'ja-JP': '日本語'
    }
  },
  navigation: {
    groups: {
      aiWorkflow: 'AI 工作流',
      agentDesign: 'Agent 设计',
      adminSettings: '管理员设置'
    },
    items: {
      workflowExecution: '工作流执行',
      workflowDesign: '工作流设计',
      agentConfig: 'Agent 配置',
      agentSkills: 'Agent 技能',
      agentKnowledge: 'Agent 知识',
      agentWorkspaces: 'Agent 工作区',
      agentClients: 'Agent Client',
      loopRuntimeConfig: '循环工程',
      aiModelConfig: 'AI 模型配置',
      members: '成员管理'
    }
  },
  header: {
    titles: {
      dashboard: 'Dashboard',
      workflowExecution: '工作流执行',
      workflowDesign: '工作流设计',
      agentConfig: 'Agent 配置',
      agentClients: 'Agent Client',
      agentWorkspaces: 'Agent 工作区',
      agentSkills: 'Agent 技能',
      agentKnowledge: 'Agent 知识',
      loopRuntimeConfig: '循环工程',
      aiModelConfig: 'AI 模型配置'
    },
    descriptions: {
      workflowExecution:
        '用于查看工作流触发的执行记录，并跟踪每次运行的最新状态。',
      workflowDesign:
        '用于将 ONES 的工作流与 Agent 打通，让 Agent 参与业务流转。',
      agentConfig:
        '用于定义 Agent 的基础配置，包括提示词、执行身份、工作区和技能绑定。',
      agentWorkspaces:
        '用于为 Agent 提供执行任务所需的工作区、代码仓和运行环境。',
      agentSkills: '用于为 Agent 提供可复用的能力、知识和执行规则。',
      agentKnowledge: '用于管理可跨 Agent 复用的 ONES Wiki 页面组知识源。'
    }
  },
  permissionDenied: {
    title: {
      adminOnly: '仅管理员可访问',
      notAppMember: '未加入当前团队',
      missingOrgAdmin: '无权限访问 AI 工作流'
    },
    description: {
      adminOnly: '当前页面仅管理员可访问，系统已阻止继续进入该功能页面。',
      notAppMember:
        '当前账号还不是这个团队下的 AI 工作流成员，系统已阻止继续进入功能页面。',
      missingOrgAdmin:
        '当前账号缺少使用本应用所需的组织级权限，系统已阻止继续进入功能页面。'
    },
    hint: {
      adminOnly:
        '如果你需要管理 Agent Client 或成员，请联系组织管理员协助处理。',
      notAppMember:
        '请联系管理员将你加入当前团队的 AI 工作流成员列表，然后刷新页面重试。',
      missingOrgAdmin:
        '请联系管理员将你的账号加入「应用」管理员权限，然后刷新当前页面重新进入。'
    },
    requiredPermission: '所需权限点'
  },
  teamSwitcher: {
    loading: '加载团队中...',
    error: '团队加载失败',
    empty: '暂无团队',
    label: '选择团队'
  },
  searchSelect: {
    placeholder: '搜索或选择',
    empty: '没有匹配项',
    overflowFiltered: '结果过多，仅展示前 {{count}} 条，请继续输入关键词',
    overflowUnfiltered: '仅展示前 {{count}} 条，请输入关键词搜索更多内容'
  },
  pages: {
    agentClients: {
      loadFailed: 'Agent Client 列表加载失败',
      approveFailed: '批准 Agent Client 失败',
      approveSuccess: 'Agent Client“{{name}}”已批准',
      revokeFailed: '撤销 Agent Client 失败',
      revokeSuccess: 'Agent Client“{{name}}”已撤销',
      empty: '暂无 Agent Client 数据',
      table: {
        name: '名称',
        hostname: '主机',
        uuid: 'UUID',
        version: '版本',
        connectionStatus: '连接状态',
        runtimeStatus: '运行状态',
        lastExchangeAt: '最近交换时间',
        actions: '操作'
      },
      actions: {
        approve: '批准',
        revoke: '撤销'
      },
      connectionStatus: {
        pending_approval: '待审批',
        approved: '已批准',
        active: '已激活',
        revoked: '已撤销'
      },
      runtimeStatus: {
        online: '在线',
        offline: '离线'
      }
    },
    issues: {
      loadFailed: '工作项列表加载失败',
      deleteFailed: '删除执行记录失败',
      deleteSuccess: '已删除当前工作项的执行记录',
      empty: '暂无工作项数据',
      table: {
        displayId: '编号',
        title: '标题',
        project: '项目',
        issueType: '类型',
        latestExecutionStatus: '最近执行状态',
        lastDispatchedAt: '最近执行时间',
        actions: '操作'
      },
      actions: {
        history: '执行记录',
        delete: '删除'
      },
      status: {
        created: '已创建',
        executing: '执行中',
        success: '成功',
        failure: '失败',
        blocked: '已阻断'
      },
      deleteDialog: {
        title: '确认删除执行记录？',
        descriptionWithIssue:
          '这会删除工作项“{{name}}”在本系统中的执行记录、日志和输入输出快照，但不会删除 ONES 中的工作项本身。',
        descriptionFallback: '这会删除当前工作项在本系统中的执行记录。'
      }
    },
    issueDetail: {
      missingUuid: '工作项 uuid 缺失',
      pageTitle: '工作项',
      loadFailed: '工作项详情加载失败',
      historiesLoadFailed: '执行历史加载失败',
      logsLoadFailed: '执行日志加载失败',
      retryFailed: '重置失败',
      retrySuccess: '已将 Agent“{{name}}”重置为待执行',
      notFound: '未找到工作项',
      empty: '暂无执行历史',
      logsSectionTitle: 'logs',
      logsSectionEmpty: '暂无日志内容',
      actions: {
        viewLogs: '日志',
        viewInput: '查看输入',
        viewOutput: '查看输出',
        retry: '重置',
        refreshLogs: '刷新日志',
        downloadLogs: '下载日志'
      },
      states: {
        logsRefreshing: '刷新中...',
        logsLoading: '日志加载中...',
        retrying: '重试中...'
      },
      table: {
        agent: 'Agent',
        iteration: '执行轮次',
        attempt: '系统尝试',
        attemptNumber: '第 {{count}} 次',
        initialIteration: '初次执行',
        revisionIteration: '第 {{count}} 轮返工',
        executeClient: '执行客户端',
        status: '状态',
        inputTokens: '输入 tokens',
        outputTokens: '输出 tokens',
        startedAt: '开始时间',
        finishedAt: '结束时间',
        actions: '操作'
      },
      status: {
        created: '已创建',
        queued: '排队中',
        running: '执行中',
        success: '成功',
        failure: '失败',
        blocked: '已阻断'
      },
      logsDialog: {
        titleWithAgent: '{{name}} 执行日志',
        titleFallback: '执行日志'
      },
      rawDialog: {
        titleInputWithAgent: '{{name}} 原始输入',
        titleOutputWithAgent: '{{name}} 原始输出',
        titleFallback: '原始内容',
        sectionTitleInput: 'input',
        sectionTitleOutput: 'output',
        emptyInput: '暂无原始输入内容',
        emptyOutput: '暂无原始输出内容'
      },
      retryDialog: {
        title: '确认重试？',
        descriptionWithAgent:
          '这会为 Agent“{{name}}”新增一次执行尝试，并保留当前记录。',
        descriptionFallback: '这会新增一次执行尝试，并保留当前记录。'
      }
    },
    workflows: {
      loadFailed: '工作流列表加载失败',
      saveFailed: '保存工作流失败',
      updateNameSuccess: '工作流名称已更新',
      createSuccess: '工作流创建成功',
      deleteFailed: '删除工作流失败',
      deleteSuccess: '工作流“{{name}}”已删除',
      toggleFailed: '更新工作流状态失败',
      enabledSuccess: '工作流已启用',
      disabledSuccess: '工作流已停用',
      validation: {
        nameRequired: '请输入工作流名称'
      },
      empty: '暂无工作流数据',
      actions: {
        create: '新增工作流',
        edit: '重命名',
        configureNodes: '节点配置',
        delete: '删除',
        save: '保存',
        createSubmit: '创建'
      },
      status: {
        enabled: '已启用',
        disabled: '已停用',
        enableAria: '启用工作流 {{name}}',
        disableAria: '停用工作流 {{name}}'
      },
      table: {
        index: '序号',
        name: '工作流名称',
        status: '状态',
        actions: '操作'
      },
      dialog: {
        editTitle: '重命名工作流',
        createTitle: '新增工作流',
        editDescription: '更新列表中的工作流展示名称，不影响已有执行节点配置。',
        createDescription: '创建一个工作流，后续再配置触发条件和执行节点。',
        nameLabel: '工作流名称',
        namePlaceholder: '请输入工作流名称',
        saving: '保存中...',
        creating: '创建中...'
      },
      deleteDialog: {
        title: '确认删除工作流？',
        descriptionWithName:
          '工作流“{{name}}”删除后不可恢复，关联的执行节点也会一起删除。',
        descriptionFallback: '工作流删除后不可恢复。'
      }
    },
    agents: {
      loadFailed: 'Agent 列表加载失败',
      createFailed: '创建 Agent 失败',
      duplicateFailed: '复制 Agent 失败',
      duplicateName: '{{name}} 副本',
      duplicateSuccess: 'Agent“{{name}}”已复制',
      deleteFailed: '删除 Agent 失败',
      deleteSuccess: 'Agent“{{name}}”已删除',
      empty: '暂无 Agent 数据',
      actions: {
        create: '新增 Agent',
        configure: '配置',
        duplicate: '复制',
        delete: '删除'
      },
      table: {
        index: '序号',
        name: 'Agent 名称',
        workspace: '工作区',
        executor: '执行身份',
        skills: '技能',
        actions: '操作'
      },
      deleteDialog: {
        title: '确认删除 Agent？',
        descriptionWithName:
          'Agent“{{name}}”删除后不可恢复。只要它仍被工作流引用，系统会阻止删除。',
        descriptionFallback: 'Agent 删除后不可恢复。'
      }
    },
    agentDetail: {
      missingUuid: 'Agent uuid 不存在',
      draftLoadFailed: 'Agent 配置加载失败',
      promptPreviewLoadFailed: '提示词预览加载失败',
      onesFieldsLoadFailed: 'ONES 字段列表加载失败',
      resourcesLoadFailed: 'Agent 绑定资源加载失败',
      workspacesLoadFailed: '工作区列表加载失败',
      skillsLoadFailed: '技能列表加载失败',
      knowledgeSourcesLoadFailed: '知识源列表加载失败',
      wikiSpacesLoadFailed: 'Wiki 页面组列表加载失败',
      executorSearchFailed: '执行身份搜索失败',
      basicConfigSaveFailed: '保存 Agent 基础配置失败',
      draftSaveFailed: '保存草稿失败',
      publishFailed: '发布 Agent 配置失败',
      publishSuccess: 'Agent 配置已发布',
      recommendation: {
        action: 'AI 生成建议',
        generating: '正在生成建议...',
        title: '推荐提示词',
        description:
          '根据 Agent 的业务目标、输入、输出和已选 Skill 生成。确认后才会应用到编辑器。',
        apply: '应用建议',
        applied: '推荐提示词已应用',
        failed: '推荐提示词生成失败',
        contextChanged: 'Agent 配置已变化，请重新生成建议。',
        notConfigured: '管理员尚未配置 AI 模型'
      },
      validation: {
        nameRequired: '请输入 Agent 名称',
        wikiWriteTargetRequired: '请为关联 Wiki 页面输出选择写入页面组',
        acceptanceCriterionRequired: '验收标准的名称和说明不能为空'
      },
      duplicateInputField: '已存在一级字段“{{name}}”的输入字段配置',
      duplicateOutputField: '已存在一级字段“{{name}}”的输出配置',
      onlyOneWikiOutput: '每个 Agent 最多配置一个关联 Wiki 页面输出字段',
      steps: {
        basic: '基础配置',
        inputs: '输入配置',
        outputs: '输出配置',
        acceptance: '验收策略',
        prompt: '提示词'
      },
      actions: {
        previewPrompt: '提示词预览',
        previousStep: '上一步',
        nextStep: '下一步',
        edit: '编辑',
        publish: '发布',
        confirm: '确定'
      },
      basic: {
        nameLabel: '名称',
        namePlaceholder: '请输入 Agent 名称',
        descriptionLabel: '业务目标',
        descriptionPlaceholder:
          '说明 Agent 的职责、处理目标、关键规则和完成标准',
        executorLabel: '执行身份',
        executorPlaceholder: '搜索 ONES 用户',
        executorSearchLoading: '搜索中...',
        executorEmpty: '没有匹配的 ONES 用户',
        executorSearchHint: '输入姓名、邮箱或工号搜索',
        executorHelpLabel: '执行身份',
        executorHelpContent:
          '不配置时，Agent 执行结果不会绑定到特定 ONES 用户身份。',
        workspaceLabel: '工作区',
        workspacePlaceholderLoading: '工作区加载中...',
        workspacePlaceholder: '可选，不选择工作区',
        workspaceEmpty: '没有可选工作区，可留空',
        workspaceHelpLabel: '工作区',
        workspaceHelpContent:
          '工作区可以留空，适用于不依赖本地代码仓的 Agent。',
        skillsLabel: '技能',
        skillsPlaceholder: '搜索或选择技能',
        skillsEmpty: '暂无可绑定技能',
        knowledgeLabel: '知识',
        knowledgePlaceholder: '搜索或选择知识源，最多 5 个',
        knowledgeEmpty: '暂无可绑定知识源',
        knowledgeHelp:
          '知识源绑定在重新发布后生效；Wiki 内容更新不需要重新发布。'
      },
      fields: {
        pickerPlaceholder: '搜索或者选择字段',
        pickerEmpty: '没有可选字段',
        addField: '添加字段',
        empty: '暂无字段，请先从上方选择一个字段。',
        emptySubFields: '暂无内部字段，请先添加一个字段。',
        emptyOutputSubFields:
          '暂无内部字段。添加后，Agent 会按这里的字段说明生成 Issue 对象内部字段内容。',
        table: {
          name: '字段名称',
          description: '字段说明',
          actions: '操作'
        },
        preview: {
          noSubFieldDescriptions: '暂未配置内部字段说明',
          noDescription: '未填写说明'
        },
        internalFieldSummaryTitle: '{{fieldName}}内部字段说明',
        inputDescriptionPlaceholder: '描述这个输入字段在 Agent 中的作用',
        inputSubFieldDescriptionPlaceholder:
          '描述这个内部字段在 Agent 中的作用',
        outputDescriptionPlaceholderObject:
          '描述这个输出字段整体要做什么，例如创建、更新或创建/更新 Issue 对象',
        outputDescriptionPlaceholderSimple: '描述这个输出字段在 Agent 中的作用',
        wikiWriteTargetLabel: 'Wiki 写入页面组',
        wikiWriteTargetPlaceholder: '选择结果写入的 Wiki 页面组',
        wikiWriteTargetEmpty: '没有可写入的 Wiki 页面组',
        wikiWriteTargetHelp:
          '知识源只负责读取；创建或追加 Wiki 内容时只允许写入这里选择的页面组。',
        outputSubFieldDescriptionPlaceholder: '描述这个内部字段如何回写',
        editInternalFieldSummaryTitle: '编辑{{fieldName}}内部字段说明',
        outputSubFieldDialogDescription:
          '一级字段说明在外层表格中直接编辑。这里仅维护 Issue 对象的内部字段，以及每个内部字段的说明。',
        inputSubFieldUnsupported:
          '当前字段不是工作项引用字段，不能配置内部字段。',
        outputSubFieldUnsupported:
          '当前字段不是 Issue 引用字段，不需要配置内部字段。',
        moveUpAria: '上移字段 {{name}}',
        moveDownAria: '下移字段 {{name}}'
      },
      acceptance: {
        title: '验收策略',
        description: '自动修正循环会逐条检查这里定义的验收标准。',
        addCriterion: '添加标准',
        knowledgeRequirement: '知识依据要求',
        knowledgeOptional: '知识可选',
        knowledgeRequired: '知识必需',
        empty: '尚未配置验收标准。未配置时不会启用自动修正循环。',
        namePlaceholder: '验收标准 {{index}}',
        descriptionPlaceholder: '描述可验证的通过条件和质量要求'
      },
      prompt: {
        placeholder: '例如：你是一个擅长需求分析的助手，请根据输入字段生成...'
      },
      preview: {
        title: '提示词预览',
        description: '这里展示由输入字段、输出字段和 Prompt 拼接出的最终内容。',
        panelTitle: '提示词预览',
        loading: '正在生成预览...'
      },
      publishDialog: {
        title: '确认发布',
        description: '发布会将当前配置保存为新版本并立即生效。是否继续？',
        publishing: '发布中...',
        confirm: '确认发布'
      }
    },
    members: {
      loadFailed: '成员列表加载失败',
      searchFailed: 'ONES 用户搜索失败',
      addFailed: '添加成员失败',
      addSuccess: '成员“{{name}}”已添加',
      removeFailed: '移除成员失败',
      removeSuccess: '成员“{{name}}”已移除',
      selectUserRequired: '请选择一个 ONES 用户',
      empty: '暂无成员',
      actions: {
        add: '添加成员',
        remove: '移除',
        confirmAdd: '确认添加',
        adding: '添加中...',
        confirmRemove: '确认移除',
        removing: '移除中...'
      },
      table: {
        name: '姓名',
        email: '邮箱',
        staffId: '工号',
        userUuid: '用户 UUID',
        createdAt: '添加时间',
        actions: '操作'
      },
      dialog: {
        title: '添加成员',
        description:
          '从 ONES 用户中选择一个账号，加入当前团队的 AI 工作流成员列表。',
        userLabel: 'ONES 用户',
        searchPlaceholderLoading: '搜索 ONES 用户中...',
        searchPlaceholder: '搜索姓名、邮箱或工号',
        searchEmptyLoading: '搜索中...',
        searchEmpty: '没有匹配的 ONES 用户',
        selectedName: '姓名：{{value}}',
        selectedEmail: '邮箱：{{value}}',
        selectedStaffId: '工号：{{value}}'
      },
      deleteDialog: {
        title: '移除成员',
        description:
          '确认要移除成员“{{name}}”吗？移除后该账号将无法继续访问当前团队的 AI 工作流。'
      }
    },
    agentWorkspaces: {
      loadFailed: '工作区列表加载失败',
      saveFailed: '保存工作区失败',
      updateSuccess: '工作区已更新',
      createSuccess: '工作区创建成功',
      deleteFailed: '删除工作区失败',
      deleteSuccess: '工作区“{{name}}”已删除',
      validation: {
        nameRequired: '请输入工作区名称'
      },
      empty: '还没有工作区，先创建一个工作区。',
      actions: {
        create: '新建工作区',
        edit: '编辑',
        repositories: '代码仓',
        credentials: '凭证',
        delete: '删除',
        save: '保存'
      },
      table: {
        workspace: '工作区',
        repositories: '代码仓',
        credentials: '凭证',
        actions: '操作',
        repositoryCount: '{{count}} 个',
        credentialCount: '{{count}} 个'
      },
      dialog: {
        createTitle: '新建工作区',
        editTitle: '编辑工作区',
        nameLabel: '名称',
        namePlaceholder: '例如：默认工作区'
      },
      deleteDialog: {
        title: '删除工作区？',
        description:
          '删除后会同时移除该工作区下的所有代码仓配置，此操作不可恢复。'
      }
    },
    agentWorkspaceCredentials: {
      missingUuid: '工作区 uuid 缺失',
      pageTitle: '工作区凭证',
      notFound: '工作区不存在',
      loadFailed: '工作区凭证加载失败',
      saveFailed: '保存凭证失败',
      saveSuccess: '凭证已保存',
      deleteFailed: '删除凭证失败',
      deleteSuccess: '凭证已删除',
      empty: '暂无凭证，添加后会在任务执行时作为环境变量注入。',
      actions: {
        create: '新增凭证',
        delete: '删除',
        save: '保存'
      },
      table: {
        envName: '变量名',
        description: '说明',
        updatedAt: '更新时间',
        actions: '操作'
      },
      dialog: {
        title: '新增凭证',
        envNameLabel: '环境变量名',
        envNamePlaceholder: 'OPENAI_API_KEY',
        envNameDescription:
          '以大写字母开头，仅支持 A-Z、0-9、_。同名会覆盖已有凭证。',
        valueLabel: '凭证值',
        valuePlaceholder: 'sk-...',
        descriptionLabel: '说明',
        descriptionPlaceholder: '用于调用 OpenAI API'
      },
      validation: {
        envNameRequired: '请输入环境变量名',
        envNameInvalid: '变量名需以大写字母开头，仅支持 A-Z、0-9、_',
        valueRequired: '请输入凭证值',
        descriptionTooLong: '说明不能超过 256 个字符'
      },
      deleteDialog: {
        title: '删除凭证？',
        description: '删除后，后续任务执行时将不再注入该环境变量。'
      }
    },
    knowledgeSources: {
      loadFailed: '知识源列表加载失败',
      spacesLoadFailed: 'Wiki 页面组列表加载失败',
      saveFailed: '知识源保存失败',
      saveSuccess: '知识源已保存',
      deleteFailed: '知识源删除失败',
      deleteSuccess: '知识源已删除',
      empty: '暂无知识源',
      actions: { create: '新建知识源', edit: '编辑', delete: '删除' },
      table: {
        name: '名称',
        space: 'Wiki 页面组',
        status: '状态',
        lastSuccess: '最近成功检索',
        lastError: '最近错误',
        actions: '操作'
      },
      status: { active: '启用', disabled: '停用', error: '异常' },
      form: {
        createTitle: '新建知识源',
        editTitle: '编辑知识源',
        description:
          '知识源引用完整的 ONES Wiki 页面组，插件不会保存页面正文。',
        name: '名称',
        space: 'Wiki 页面组',
        spacePlaceholder: '搜索或选择页面组',
        detail: '说明',
        status: '状态',
        required: '请填写名称并选择 Wiki 页面组'
      },
      deleteDialog: {
        title: '删除知识源？',
        description:
          '确认删除“{{name}}”吗？如果仍被 Agent 草稿或已发布版本引用，系统会阻止删除。'
      }
    },
    skills: {
      loadFailed: '技能列表加载失败',
      downloadFailed: '技能下载失败',
      uploadFailed: '技能上传失败',
      uploadSuccess: '技能上传成功',
      uploadVersionFailed: '技能新版本上传失败',
      uploadVersionSuccess: '技能新版本上传成功',
      deleteFailed: '技能删除失败',
      deleteSuccess: '技能“{{name}}”已删除',
      empty: '暂无技能数据',
      ai: {
        create: 'AI 创建',
        creating: '创建中...',
        createFailed: '创建 Skill 草稿失败',
        notConfigured: '管理员尚未配置 AI 模型',
        drafts: '未完成的 AI 草稿'
      },
      validation: {
        filesRequired: '请选择一个目录'
      },
      actions: {
        upload: '上传技能',
        download: '下载',
        uploadVersion: '上传新版本',
        delete: '删除',
        startUpload: '开始上传',
        confirmUpload: '上传'
      },
      table: {
        name: '名称',
        description: '描述',
        currentVersion: '当前版本',
        updatedAt: '更新时间',
        actions: '操作'
      },
      dialog: {
        createTitle: '上传技能',
        createDescription:
          '选择一个技能目录进行上传，目录内容需要符合技能规范。',
        uploadTitle: '上传技能新版本',
        uploadDescriptionWithName:
          '为 {{name}} 上传新的目录数据包。系统会重新从包内 SKILL.md 提取元数据。',
        uploadDescriptionFallback:
          '上传新的目录数据包。系统会重新从包内 SKILL.md 提取元数据。',
        directoryLabel: '技能目录',
        selectedFiles: '已选择 {{count}} 个文件'
      },
      deleteDialog: {
        title: '删除技能',
        descriptionWithName:
          '确认删除技能“{{name}}”吗？这会删除该技能的所有版本和本地存储文件。',
        descriptionFallback: '确认删除该技能吗？'
      }
    },
    skillCreator: {
      title: 'AI 创建 Skill',
      missingUuid: '缺少 Skill 草稿标识',
      loadFailed: 'Skill 草稿加载失败',
      messageFailed: '发送消息失败',
      generateFailed: '生成 Skill 文件失败',
      generateSuccess: 'Skill 文件已生成',
      saveFailed: '保存 Skill 文件失败',
      saveSuccess: 'Skill 文件已保存',
      publishFailed: '创建 Skill 失败',
      publishSuccess: 'Skill“{{name}}”已创建',
      chat: '对话',
      files: '文件',
      you: '你',
      assistant: 'AI 助手',
      interrupted: '响应已中断',
      emptyChat: '描述你希望 Skill 完成的工作，AI 会通过多轮对话帮助补全需求。',
      emptyFiles: '完成需求沟通后，点击“生成 Skill”创建文件包。',
      noFileSelected: '未选择文件',
      unsaved: '未保存',
      messagePlaceholder:
        '描述目标、输入、处理规则和期望输出。Command/Ctrl + Enter 发送。',
      scriptReview: '我已逐个审核生成的脚本文件，并确认其执行行为',
      actions: {
        send: '发送',
        generate: '生成 Skill',
        regenerate: '重新生成',
        save: '保存文件',
        publish: '确认创建'
      },
      status: {
        draft: '需求沟通中',
        generating: '生成中',
        ready: '文件待审核',
        published: '已创建',
        failed: '上次生成失败'
      },
      stages: {
        thinking: 'AI 正在回复',
        generating_files: '正在生成文件包',
        repairing_structure: '正在修复文件结构'
      }
    },
    loopRuntimeConfig: {
      title: '循环工程总开关',
      description: '控制当前团队是否允许创建新的自动修正尝试。',
      switchLabel: '启用循环工程',
      switchHelp: '关闭后现有 Agent 和工作流继续按单次执行模式运行。',
      enabled: '已开启',
      disabled: '已关闭',
      loadFailed: '循环工程配置加载失败',
      saveFailed: '循环工程配置保存失败',
      saveSuccess: '循环工程配置已保存'
    },
    aiModelConfig: {
      title: '组织默认 AI 模型',
      description:
        '用于 AI 创建 Skill 和生成 Agent 推荐提示词，不影响 Agent Client 的执行模型。',
      loadFailed: 'AI 模型配置加载失败',
      saveFailed: 'AI 模型配置保存失败',
      saveSuccess: 'AI 模型配置已保存',
      testFailed: '模型连接测试失败',
      testSuccess: '模型连接测试成功',
      validationFailed:
        '请填写有效的 HTTPS 地址、模型名称和 0-2 之间的 Temperature。',
      baseURL: 'Base URL',
      model: '模型名称',
      keyConfigured: 'API Key 已配置',
      keyMissing: 'API Key 未配置',
      keyPlaceholder: '输入 API Key',
      keyReplacePlaceholder: '留空保留当前密钥，输入新值可替换',
      keyHelp: '密钥会加密保存，保存后不会再次回显。',
      test: '测试连接',
      testing: '测试中...'
    },
    workflowDetail: {
      missingUuid: '工作流 uuid 缺失',
      pageTitle: '工作流',
      loadFailed: '工作流详情加载失败',
      optionsLoadFailed: '下拉数据加载失败',
      projectsLoadFailed: '项目列表加载失败',
      issueTypesLoadFailed: '工作项类型列表加载失败',
      statusesLoadFailed: '状态列表加载失败',
      agentsLoadFailed: 'Agent 列表加载失败',
      createNodeFailed: '新增执行节点失败',
      updateNodeFailed: '编辑执行节点失败',
      createNodeSuccess: '执行节点已创建',
      updateNodeSuccess: '执行节点已更新',
      deleteNodeFailed: '删除执行节点失败',
      deleteNodeSuccess: '执行节点已删除',
      empty: '暂无执行节点数据',
      validation: {
        projectRequired: '请选择项目',
        issueTypeRequired: '请选择工作项类型',
        statusRequired: '请选择状态',
        agentRequired: '请选择 Agent',
        targetStatusRequired: '请选择任务成功后的目标状态',
        targetStatusMustDiffer: '任务成功后的目标状态不能与触发状态相同',
        maxAttemptsInvalid: '总尝试次数必须是 1-5 的整数',
        maxDurationInvalid: '总时长必须是 1-120 分钟的整数',
        maxTokensInvalid: '总 Token 必须是 1000-1000000 的整数',
        escalationStatusRequired: '请选择人工接管状态',
        escalationStatusMustDiffer: '人工接管状态不能与触发状态或成功状态相同',
        incompleteSelection: '表单数据不完整，请重新选择'
      },
      actions: {
        createNode: '新增执行节点',
        edit: '编辑',
        delete: '删除',
        save: '保存',
        create: '创建'
      },
      table: {
        index: '序号',
        project: '项目',
        issueType: '工作项类型',
        status: '状态',
        agent: '绑定 Agent',
        postAction: '成功后置动作',
        transitionTo: '流转到「{{status}}」',
        missingPostAction: '未配置，编辑时需补齐',
        revisionContext: '返工上下文',
        revisionEnabled: '已启用',
        revisionDisabled: '未启用',
        loopPolicy: '自动修正',
        loopEnabled: '最多 {{count}} 次',
        loopDisabled: '未启用',
        actions: '操作'
      },
      dialog: {
        createTitle: '新增执行节点',
        editTitle: '编辑执行节点',
        createDescription:
          '配置这个节点在什么项目、什么工作项类型和状态下触发，并指定执行的 Agent 和任务成功后的目标状态。',
        editDescription:
          '更新执行节点的项目、工作项类型、触发状态、绑定 Agent 和任务成功后的目标状态。',
        projectLabel: '项目',
        projectPlaceholderLoading: '项目加载中...',
        projectPlaceholder: '搜索或选择项目',
        projectEmpty: '没有可选项目',
        issueTypeLabel: '工作项类型',
        issueTypePlaceholderLoading: '工作项类型加载中...',
        issueTypePlaceholder: '搜索或选择工作项类型',
        issueTypeEmpty: '没有可选工作项类型',
        statusLabel: '状态',
        statusPlaceholderLoading: '状态加载中...',
        statusPlaceholder: '搜索或选择状态',
        statusEmpty: '没有可选状态',
        agentLabel: 'Agent',
        agentPlaceholderLoading: 'Agent 加载中...',
        agentPlaceholder: '搜索或选择 Agent',
        agentEmpty: '没有匹配的 Agent',
        successTransitionLabel: '任务成功后的目标状态',
        successTransitionPlaceholder: '选择任务成功后的目标状态',
        revisionContextLabel: '审核退回时继承历史结果和评论',
        revisionContextHelp:
          '同一节点再次触发时，Agent 会读取历史执行结果和新增审核评论；没有新增评论时任务将阻断。',
        loopPolicyLabel: '启用自动修正循环',
        loopPolicyHelp:
          '总开关开启且 Agent 已发布验收标准时，未通过的候选结果会自动进入下一次尝试。',
        maxAttemptsLabel: '总尝试次数',
        maxDurationLabel: '总时长（分钟）',
        maxTokensLabel: '总 Token',
        escalationStatusLabel: '人工接管状态',
        escalationStatusPlaceholder: '选择循环耗尽后的人工接管状态',
        saving: '保存中...',
        creating: '创建中...'
      },
      deleteDialog: {
        title: '确认删除执行节点？',
        description:
          '删除后不可恢复，该节点的项目、工作项类型、状态和 Agent 绑定配置都会被移除。'
      }
    },
    agentWorkspaceRepositories: {
      missingUuid: '工作区 uuid 缺失',
      pageTitle: '工作区代码仓',
      notFound: '工作区不存在。',
      loadFailed: '工作区详情加载失败',
      workspaceListLoadFailed: '工作区列表加载失败',
      saveRepositoryFailed: '保存仓库失败',
      updateRepositorySuccess: '仓库已更新',
      createRepositorySuccess: '仓库创建成功',
      createRepositoriesSuccess: '已创建 {{count}} 个仓库',
      deleteRepositoryFailed: '删除仓库失败',
      deleteRepositorySuccess: '仓库已删除',
      saveAuthFailed: '保存认证失败',
      saveAuthSuccess: '认证方式已更新',
      copyPublicKeyUnavailable: '当前工作区还没有可复制的 SSH 公钥',
      copyPublicKeySuccess: 'SSH 公钥已复制',
      copyPublicKeyFailed: '复制 SSH 公钥失败',
      generateSshKeyFailed: '生成 SSH 密钥失败',
      generateSshKeySuccess: 'SSH 密钥已生成',
      regenerateSshKeySuccess: 'SSH 密钥已更新',
      empty: '暂无仓库，先添加一个代码仓。',
      validation: {
        repositoryUrlRequired: '请输入仓库地址',
        repositoryUrlListRequired: '请输入至少一个仓库地址',
        repositoryUrlInvalid: '每行都必须是有效的 Git SSH 或 HTTPS 地址',
        httpsUsernameRequired: '请输入 HTTPS 用户名',
        sshUrlOnly: '当前工作区使用 SSH 认证，只能填写 Git SSH 地址。',
        httpsUrlOnly: '当前工作区使用 HTTPS 认证，只能填写 HTTPS 仓库地址。',
        publicHttpsUrlOnly:
          '当前工作区未配置认证，只能填写公开 HTTPS 仓库地址。'
      },
      actions: {
        createRepository: '新增仓库',
        authSettings: '认证管理',
        edit: '编辑',
        delete: '删除',
        save: '保存',
        copyPublicKey: '复制公钥',
        copied: '已复制',
        generateKey: '生成密钥',
        regenerateKey: '重新生成'
      },
      table: {
        url: '仓库地址',
        browseUrl: '浏览链接',
        actions: '操作',
        browseUrlUnavailable: '无法解析'
      },
      repositoryDialog: {
        createTitle: '新增仓库',
        editTitle: '编辑仓库',
        urlListLabel: '仓库地址（每行一个）',
        urlLabel: '仓库地址'
      },
      authDialog: {
        title: '认证管理',
        typeLabel: '认证方式',
        typePlaceholder: '选择认证方式',
        typeNone: '无认证（公开 HTTPS 仓库）',
        typeSsh: 'SSH 公钥',
        typeHttps: 'HTTPS 用户名 + 密钥',
        sshPublicKeyLabel: 'SSH 公钥',
        sshPublicKeyPlaceholder: '当前还没有生成 SSH 公钥',
        sshPublicKeyDescription:
          '把这把公钥添加到目标仓库的 Deploy Key 或只读公钥配置中。',
        usernameLabel: '用户名',
        usernamePlaceholder: '例如：git-bot',
        usernameDescription:
          '常见场景为 Git 用户名、服务账号名或固定占位用户名。',
        secretLabel: '密钥',
        secretPlaceholder: '输入 Token、PAT 或兼容密码',
        secretDescriptionKeep: '留空则保留当前已保存的密钥。',
        secretDescriptionRequired: '请输入可用于 Git HTTPS 访问的密钥。'
      },
      authDescription: {
        ssh: '适用于通过 Deploy Key 或机器账号访问 SSH 仓库。',
        https: '适用于通过用户名与 Token/PAT/兼容密码访问 HTTPS 私有仓库。',
        none: '仅适用于公开 HTTPS 仓库，不会提供额外认证信息。'
      },
      repositoryInputDescription: {
        ssh: '当前工作区使用 SSH 认证，只能添加 `git@...` 或 `ssh://...` 仓库地址。',
        https: '当前工作区使用 HTTPS 认证，只能添加 `https://...` 仓库地址。',
        none: '当前工作区未配置认证，只能添加公开 `https://...` 仓库地址。'
      },
      generateSshKeyDialog: {
        titleGenerate: '生成 SSH 密钥？',
        titleRegenerate: '重新生成 SSH 密钥？',
        descriptionGenerate:
          '生成后，可以把新的公钥配置到对应 Git 仓库作为 Deploy Key。',
        descriptionRegenerate:
          '重新生成后，旧私钥会立即失效。你需要把新的公钥重新配置到所有使用该 workspace 的 Git 仓库。',
        confirmGenerate: '生成',
        confirmRegenerate: '重新生成'
      },
      deleteDialog: {
        title: '删除仓库？',
        description: '将从工作区中移除此代码仓配置，但不会影响远端仓库本身。'
      }
    },
    placeholder: {
      description: '空页面占位'
    }
  }
} as const;
