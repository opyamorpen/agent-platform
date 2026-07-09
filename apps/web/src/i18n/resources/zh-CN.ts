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
      cancel: '取消',
      done: '完成',
      confirmDelete: '确认删除',
      retry: '刷新后重试'
    },
    states: {
      loading: '加载中...',
      deleting: '删除中...'
    },
    fallback: {
      currentUser: '当前用户',
      emptyValue: '-',
      error: '操作失败，请稍后重试'
    }
  },
  apiErrors: {
    codes: {
      'auth.user_not_logged_in': '当前登录状态已失效，请重新登录。',
      'auth.missing_authorization_header': '当前登录状态已失效，请重新登录。',
      'auth.invalid_authorization_token': '当前登录凭证无效，请重新登录。',
      'auth.organization_identifier_missing': '当前登录凭证缺少组织信息，请重新登录。',
      'auth.team_uuid_required': '缺少团队上下文，请重新选择团队后重试。',
      'auth.selected_team_not_accessible': '当前选择的团队不可访问，请重新选择团队后重试。',
      'access.not_app_member': '当前账号不是当前团队的 AI 工作流成员，请联系管理员添加。',
      'access.admin_only': '当前页面仅管理员可访问。',
      'common.internal_server_error': '服务内部错误，请稍后重试。',
      'common.route_not_found': '请求的接口不存在。',
      'skills.invalid_payload': '技能请求参数无效。',
      'skills.invalid_package_payload': '技能包内容无效，请检查目录结构和 SKILL.md。',
      'skills.uuid_required': '缺少技能标识。',
      'skills.version_invalid': '技能版本号无效。',
      'skills.not_found': '未找到对应的技能。',
      'skills.conflict': '已存在同名技能，请修改后重试。',
      'skills.in_use': '该技能仍被 Agent 引用，暂时不能删除。',
      'agent_clients.invalid_connect_payload': 'Agent Client 连接请求参数无效。',
      'agent_clients.invalid_connect_poll_payload': 'Agent Client 轮询请求参数无效。',
      'agent_clients.invalid_connection_request': 'Agent Client 连接请求已失效，请重新发起连接。',
      'agent_clients.uuid_required': '缺少 Agent Client 标识。',
      'agent_clients.not_found': '未找到对应的 Agent Client。',
      'executions.dispatched_issue_uuid_required': '缺少工作项执行记录标识。',
      'executions.dispatched_issue_not_found': '未找到对应的工作项执行记录。',
      'executions.issue_execution_history_uuid_required': '缺少执行历史标识。',
      'executions.issue_execution_history_not_found': '未找到对应的执行历史。',
      'executions.issue_agent_execution_history_uuid_required': '缺少 Agent 执行历史标识。',
      'executions.issue_agent_execution_history_not_found': '未找到对应的 Agent 执行历史。',
      'executions.issue_agent_execution_retry_not_allowed':
        '当前 Agent 执行记录不允许重置，请刷新后重试。',
      'workflows.uuid_required': '缺少工作流标识。',
      'workflows.invalid_payload': '工作流请求参数无效。',
      'workflows.not_found': '未找到对应的工作流。',
      'workflows.node_uuid_required': '缺少执行节点标识。',
      'workflows.invalid_node_payload': '执行节点请求参数无效。',
      'workflows.node_not_found': '未找到对应的执行节点。',
      'workflows.node_executor_invalid':
        '当前工作流只支持可由 Agent Client 执行的 Agent。请确认 Agent 不是“仅模型”模式，并已配置执行身份。',
      'workflows.deletion_blocked': '工作流下仍有执行节点，请先删除执行节点后再删除工作流。',
      'agents.invalid_payload': 'Agent 请求参数无效。',
      'agents.invalid_prompt_preview_payload': '提示词预览请求参数无效。',
      'agents.invalid_draft_payload': 'Agent 草稿请求参数无效。',
      'agents.invalid_publish_payload': 'Agent 发布请求参数无效。',
      'agents.workspace_binding_not_found': 'Agent 绑定的工作区不存在。',
      'agents.skill_binding_not_found': 'Agent 绑定的技能不存在。',
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
      'agent_workspaces.auth_conflict': '当前工作区认证配置与操作不兼容，请先调整认证配置。',
      'agent_workspaces.repository_uuid_required': '缺少代码仓标识。',
      'agent_workspaces.invalid_repository_payload': '代码仓请求参数无效。',
      'agent_workspaces.repository_not_found': '未找到对应的代码仓。',
      'agent_workspaces.invalid_auth_payload': '工作区认证参数无效。',
      'agent_workspaces.invalid_credential_payload': '工作区凭证参数无效。',
      'agent_workspaces.credential_env_name_required': '缺少凭证环境变量名。',
      'agent_workspaces.credential_not_found': '未找到对应的工作区凭证。'
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
      modelProfiles: '模型配置',
      agentSkills: 'Agent 技能',
      agentWorkspaces: 'Agent 工作区',
      agentClients: 'Agent Client',
      members: '成员管理'
    }
  },
  header: {
    titles: {
      dashboard: 'Dashboard',
      workflowExecution: '工作流执行',
      workflowDesign: '工作流设计',
      agentConfig: 'Agent 配置',
      modelProfiles: '模型配置',
      agentClients: 'Agent Client',
      agentWorkspaces: 'Agent 工作区',
      agentSkills: 'Agent 技能'
    },
    descriptions: {
      workflowExecution: '用于查看工作流触发的执行记录，并跟踪每次运行的最新状态。',
      workflowDesign: '用于将 ONES 的工作流与 Agent 打通，让 Agent 参与业务流转。',
      agentConfig: '用于定义 Agent 的基础配置，包括提示词、执行身份、工作区和技能绑定。',
      modelProfiles: '用于维护可复用的 AI 模型档案，供不同 Agent 独立选择。',
      agentWorkspaces: '用于为 Agent 提供执行任务所需的工作区、代码仓和运行环境。',
      agentSkills: '用于为 Agent 提供可复用的能力、知识和执行规则。'
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
      notAppMember: '当前账号还不是这个团队下的 AI 工作流成员，系统已阻止继续进入功能页面。',
      missingOrgAdmin: '当前账号缺少使用本应用所需的组织级权限，系统已阻止继续进入功能页面。'
    },
    hint: {
      adminOnly: '如果你需要管理 Agent Client 或成员，请联系组织管理员协助处理。',
      notAppMember: '请联系管理员将你加入当前团队的 AI 工作流成员列表，然后刷新页面重试。',
      missingOrgAdmin: '请联系管理员将你的账号加入「应用」管理员权限，然后刷新当前页面重新进入。'
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
        add: '添加 Agent Client',
        approve: '批准',
        revoke: '撤销',
        copy: '复制',
        copied: '已复制',
        reset: '重置'
      },
      addDialog: {
        title: '添加 Agent Client',
        description:
          '生成 Agent Client 的启动配置。客户端启动后会自动发起连接申请，管理员批准后才会开始领取任务。',
        serverBaseUrlLabel: '服务地址',
        serverBaseUrlDescription:
          'Agent Client 可访问的插件后端地址；部署到其他机器时请确认网络可达。',
        clientUUIDLabel: 'Client UUID',
        clientNameLabel: 'Client 名称',
        concurrencyLabel: '并发任务数',
        workingRootLabel: '工作目录',
        localTab: '本地',
        dockerTab: 'Docker',
        envTab: '.env',
        localCommandLabel: '本地启动命令',
        dockerComposeLabel: 'Docker Compose 片段',
        envFileLabel: '.env 配置',
        copySuccess: '启动配置已复制',
        copyFailed: '复制启动配置失败',
        afterStartTitle: '启动后的审批流程',
        afterStartDescription:
          '运行配置后，Agent Client 会出现在当前列表中并显示为“待审批”。点击批准后，客户端会收到访问令牌并开始执行任务。'
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
        retrying: '重置中...'
      },
      table: {
        agent: 'Agent',
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
        title: '确认重置？',
        descriptionWithAgent:
          '这会将 Agent“{{name}}”的当前执行记录重置为待执行状态，不会新增记录。',
        descriptionFallback: '这会将当前执行记录重置为待执行状态，不会新增记录。'
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
        edit: '编辑',
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
        editTitle: '编辑工作流名称',
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
        descriptionWithName: '工作流“{{name}}”删除后不可恢复，关联的执行节点也会一起删除。',
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
        descriptionWithName: 'Agent“{{name}}”删除后不可恢复。只要它仍被工作流引用，系统会阻止删除。',
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
      executorSearchFailed: '执行身份搜索失败',
      basicConfigSaveFailed: '保存 Agent 基础配置失败',
      draftSaveFailed: '保存草稿失败',
      publishFailed: '发布 Agent 配置失败',
      publishSuccess: 'Agent 配置已发布',
      validation: {
        nameRequired: '请输入 Agent 名称'
      },
      duplicateInputField: '已存在一级字段“{{name}}”的输入字段配置',
      duplicateOutputField: '已存在一级字段“{{name}}”的输出配置',
      steps: {
        basic: '基础配置',
        inputs: '输入配置',
        outputs: '输出配置',
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
        executionModeLabel: '执行模式',
        executionModeModelOnly: '仅模型',
        executionModeModelOnlyDescription: '只用模型处理 ONES 数据、总结、判断和生成内容',
        executionModeModelOnlyNotice:
          '仅模型模式用于不访问代码仓的研发管理任务；当前版本暂不进入工作流自动执行。',
        executionModeAgentClient: 'Agent Client',
        executionModeAgentClientDescription: '通过外部执行节点访问代码仓、运行命令和回写结果',
        executionModeAgentClientNotice:
          'Agent Client 模式适合代码仓分析、改代码、跑测试等需要外部运行环境的任务。',
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
        skillsEmpty: '暂无可绑定技能'
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
        inputSubFieldDescriptionPlaceholder: '描述这个内部字段在 Agent 中的作用',
        outputDescriptionPlaceholderObject:
          '描述这个输出字段整体要做什么，例如创建、更新或创建/更新 Issue 对象',
        outputDescriptionPlaceholderSimple: '描述这个输出字段在 Agent 中的作用',
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
      prompt: {
        placeholder:
          '例如：你是一个擅长需求分析的助手，请根据输入字段生成...'
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
        description: '从 ONES 用户中选择一个账号，加入当前团队的 AI 工作流成员列表。',
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
        description: '确认要移除成员“{{name}}”吗？移除后该账号将无法继续访问当前团队的 AI 工作流。'
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
        description: '删除后会同时移除该工作区下的所有代码仓配置，此操作不可恢复。'
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
        envNameDescription: '以大写字母开头，仅支持 A-Z、0-9、_。同名会覆盖已有凭证。',
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
        createDescription: '选择一个技能目录进行上传，目录内容需要符合技能规范。',
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
        actions: '操作'
      },
      dialog: {
        createTitle: '新增执行节点',
        editTitle: '编辑执行节点',
        createDescription:
          '配置这个节点在什么项目、什么工作项类型和状态下触发，并指定执行的 Agent。',
        editDescription: '更新执行节点的项目、工作项类型、状态和绑定 Agent。',
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
        publicHttpsUrlOnly: '当前工作区未配置认证，只能填写公开 HTTPS 仓库地址。'
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
        sshPublicKeyDescription: '把这把公钥添加到目标仓库的 Deploy Key 或只读公钥配置中。',
        usernameLabel: '用户名',
        usernamePlaceholder: '例如：git-bot',
        usernameDescription: '常见场景为 Git 用户名、服务账号名或固定占位用户名。',
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
        descriptionGenerate: '生成后，可以把新的公钥配置到对应 Git 仓库作为 Deploy Key。',
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
