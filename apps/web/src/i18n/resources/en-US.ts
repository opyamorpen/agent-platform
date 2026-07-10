export const enUS = {
  app: {
    loading: 'Loading application...',
    teamLoadFailed: 'Failed to load teams',
    accessLoadFailed: 'Failed to load permissions',
    noAvailableTeam: 'No teams are available for the current account'
  },
  common: {
    actions: {
      refresh: 'Refresh',
      cancel: 'Cancel',
      confirmDelete: 'Confirm delete',
      retry: 'Retry after refresh'
    },
    states: {
      loading: 'Loading...',
      deleting: 'Deleting...'
    },
    fallback: {
      currentUser: 'Current user',
      emptyValue: '-',
      error: 'Operation failed. Please try again later.'
    }
  },
  apiErrors: {
    codes: {
      'auth.user_not_logged_in': 'Your session has expired. Please sign in again.',
      'auth.missing_authorization_header': 'Your session has expired. Please sign in again.',
      'auth.invalid_authorization_token': 'Your sign-in token is invalid. Please sign in again.',
      'auth.organization_identifier_missing':
        'Your sign-in token is missing organization information. Please sign in again.',
      'auth.team_uuid_required': 'Missing team context. Select a team and try again.',
      'auth.selected_team_not_accessible':
        'The selected team is not accessible. Select another team and try again.',
      'access.not_app_member':
        'Your account is not a member of AI Workflow for the current team. Ask an administrator to add you.',
      'access.admin_only': 'This page is only available to administrators.',
      'common.internal_server_error': 'Internal server error. Please try again later.',
      'common.route_not_found': 'The requested endpoint was not found.',
      'skills.invalid_payload': 'The skill request payload is invalid.',
      'skills.invalid_package_payload':
        'The skill package is invalid. Check the directory structure and SKILL.md.',
      'skills.uuid_required': 'Missing skill identifier.',
      'skills.version_invalid': 'The skill version is invalid.',
      'skills.not_found': 'The requested skill was not found.',
      'skills.conflict': 'A skill with the same name already exists.',
      'skills.in_use': 'This skill is still referenced by an agent and cannot be deleted.',
      'agent_clients.invalid_connect_payload':
        'The agent client connection request payload is invalid.',
      'agent_clients.invalid_connect_poll_payload':
        'The agent client poll request payload is invalid.',
      'agent_clients.invalid_connection_request':
        'The agent client connection request is no longer valid. Start a new connection request.',
      'agent_clients.uuid_required': 'Missing agent client identifier.',
      'agent_clients.not_found': 'The requested agent client was not found.',
      'executions.dispatched_issue_uuid_required':
        'Missing issue execution record identifier.',
      'executions.dispatched_issue_not_found':
        'The requested issue execution record was not found.',
      'executions.issue_execution_history_uuid_required':
        'Missing execution history identifier.',
      'executions.issue_execution_history_not_found':
        'The requested execution history was not found.',
      'executions.issue_agent_execution_history_uuid_required':
        'Missing agent execution history identifier.',
      'executions.issue_agent_execution_history_not_found':
        'The requested agent execution history was not found.',
      'executions.issue_agent_execution_retry_not_allowed':
        'The current agent execution record cannot be retried. Refresh and try again.',
      'workflows.uuid_required': 'Missing workflow identifier.',
      'workflows.invalid_payload': 'The workflow request payload is invalid.',
      'workflows.not_found': 'The requested workflow was not found.',
      'workflows.node_uuid_required': 'Missing workflow node identifier.',
      'workflows.invalid_node_payload': 'The workflow node payload is invalid.',
      'workflows.node_not_found': 'The requested workflow node was not found.',
      'workflows.node_executor_invalid':
        'The agent binding on the workflow node is invalid.',
      'workflows.deletion_blocked':
        'This workflow still contains execution nodes. Delete those nodes before deleting the workflow.',
      'agents.invalid_payload': 'The agent request payload is invalid.',
      'agents.invalid_prompt_preview_payload': 'The prompt preview payload is invalid.',
      'agents.invalid_draft_payload': 'The agent draft payload is invalid.',
      'agents.invalid_publish_payload': 'The agent publish payload is invalid.',
      'agents.workspace_binding_not_found': 'The bound agent workspace was not found.',
      'agents.skill_binding_not_found': 'The bound agent skill was not found.',
      'agents.conflict': 'Agent data is in conflict. Refresh and try again.',
      'agents.uuid_required': 'Missing agent identifier.',
      'agents.not_found': 'The requested agent was not found.',
      'agents.draft_not_found': 'There is no draft configuration available to publish for this agent.',
      'agents.in_use': 'This agent is still referenced by a workflow and cannot be deleted.',
      'members.invalid_payload': 'The member request payload is invalid.',
      'members.conflict': 'This member already exists.',
      'members.user_uuid_required': 'Missing member user identifier.',
      'members.not_found': 'The requested member was not found.',
      'ones.config_error':
        'The ONES integration configuration is invalid. Ask an administrator to check it.',
      'ones.request_error': 'Failed to request the ONES service. Please try again later.',
      'ones.response_error':
        'The ONES service returned a response that could not be processed. Please try again later.',
      'ones.invalid_user_search_query': 'The ONES user search query is invalid.',
      'agent_workspaces.invalid_payload': 'The workspace request payload is invalid.',
      'agent_workspaces.uuid_required': 'Missing workspace identifier.',
      'agent_workspaces.not_found': 'The requested workspace was not found.',
      'agent_workspaces.in_use': 'This workspace is still referenced by an agent and cannot be deleted.',
      'agent_workspaces.auth_conflict': 'The current workspace auth configuration is incompatible with this operation.',
      'agent_workspaces.repository_uuid_required': 'Missing repository identifier.',
      'agent_workspaces.invalid_repository_payload': 'The repository request payload is invalid.',
      'agent_workspaces.repository_not_found': 'The requested repository was not found.',
      'agent_workspaces.invalid_auth_payload': 'The workspace auth payload is invalid.',
      'agent_workspaces.invalid_credential_payload': 'The workspace credential payload is invalid.',
      'agent_workspaces.credential_env_name_required': 'Missing credential environment variable name.',
      'agent_workspaces.credential_not_found': 'The requested workspace credential was not found.'
    }
  },
  language: {
    label: 'Language',
    options: {
      'zh-CN': 'Simplified Chinese',
      'en-US': 'English',
      'ja-JP': 'Japanese'
    }
  },
  navigation: {
    groups: {
      aiWorkflow: 'AI Workflow',
      agentDesign: 'Agent Design',
      adminSettings: 'Admin Settings'
    },
    items: {
      workflowExecution: 'Workflow Runs',
      workflowDesign: 'Workflow Design',
      agentConfig: 'Agent Config',
      modelProfiles: 'Model Profiles',
      agentSkills: 'Agent Skills',
      agentWorkspaces: 'Agent Workspaces',
      agentClients: 'Agent Clients',
      members: 'Members'
    }
  },
  header: {
    titles: {
      dashboard: 'Dashboard',
      workflowExecution: 'Workflow Runs',
      workflowDesign: 'Workflow Design',
      agentConfig: 'Agent Config',
      modelProfiles: 'Model Profiles',
      agentClients: 'Agent Clients',
      agentWorkspaces: 'Agent Workspaces',
      agentSkills: 'Agent Skills'
    },
    descriptions: {
      workflowExecution:
        'View workflow-triggered execution records and track the latest status of each run.',
      workflowDesign:
        'Connect ONES workflows with agents so they can participate in business flow execution.',
      agentConfig:
        'Define base agent settings such as prompts, execution identity, workspace, and bound skills.',
      modelProfiles:
        'Maintain reusable AI model profiles that each agent can select independently.',
      agentWorkspaces:
        'Provide agents with the workspaces, repositories, and runtime environment they need to execute tasks.',
      agentSkills:
        'Provide reusable capabilities, knowledge, and execution rules for agents.'
    }
  },
  permissionDenied: {
    title: {
      adminOnly: 'Admins only',
      notAppMember: 'Not in current team',
      missingOrgAdmin: 'No access to AI Workflow'
    },
    description: {
      adminOnly:
        'This page is only available to administrators, so access has been blocked.',
      notAppMember:
        'Your account is not yet a member of AI Workflow for this team, so access has been blocked.',
      missingOrgAdmin:
        'Your account is missing the organization-level permission required to use this app, so access has been blocked.'
    },
    hint: {
      adminOnly:
        'If you need to manage agent clients or members, contact an organization administrator.',
      notAppMember:
        'Ask an administrator to add you to AI Workflow members for this team, then refresh and try again.',
      missingOrgAdmin:
        'Ask an administrator to grant your account the application administrator permission, then reload the page.'
    },
    requiredPermission: 'Required permission'
  },
  teamSwitcher: {
    loading: 'Loading teams...',
    error: 'Failed to load teams',
    empty: 'No teams',
    label: 'Select team'
  },
  searchSelect: {
    placeholder: 'Search or select',
    empty: 'No matches found',
    overflowFiltered:
      'Too many results. Showing the first {{count}} items. Keep typing to narrow it down.',
    overflowUnfiltered:
      'Showing the first {{count}} items. Type keywords to search more results.'
  },
  pages: {
    agentClients: {
      loadFailed: 'Failed to load agent clients',
      approveFailed: 'Failed to approve agent client',
      approveSuccess: 'Agent client "{{name}}" approved',
      revokeFailed: 'Failed to revoke agent client',
      revokeSuccess: 'Agent client "{{name}}" revoked',
      empty: 'No agent client data',
      table: {
        name: 'Name',
        hostname: 'Host',
        uuid: 'UUID',
        version: 'Version',
        connectionStatus: 'Connection status',
        runtimeStatus: 'Runtime status',
        lastExchangeAt: 'Last exchange',
        actions: 'Actions'
      },
      actions: {
        approve: 'Approve',
        revoke: 'Revoke'
      },
      connectionStatus: {
        pending_approval: 'Pending approval',
        approved: 'Approved',
        active: 'Active',
        revoked: 'Revoked'
      },
      runtimeStatus: {
        online: 'Online',
        offline: 'Offline'
      }
    },
    issues: {
      loadFailed: 'Failed to load issues',
      deleteFailed: 'Failed to delete execution record',
      deleteSuccess: 'Deleted the current issue execution record',
      empty: 'No issue data',
      table: {
        displayId: 'ID',
        title: 'Title',
        project: 'Project',
        issueType: 'Type',
        latestExecutionStatus: 'Latest execution status',
        lastDispatchedAt: 'Last execution time',
        actions: 'Actions'
      },
      actions: {
        history: 'Execution history',
        delete: 'Delete'
      },
      status: {
        created: 'Created',
        executing: 'Running',
        success: 'Success',
        failure: 'Failure',
        blocked: 'Blocked'
      },
      deleteDialog: {
        title: 'Delete execution record?',
        descriptionWithIssue:
          'This deletes the execution record, logs, and input/output snapshots for issue "{{name}}" in this system, but does not delete the issue itself in ONES.',
        descriptionFallback:
          'This deletes the execution record for the current issue in this system.'
      }
    },
    issueDetail: {
      missingUuid: 'Missing issue uuid',
      pageTitle: 'Issue',
      loadFailed: 'Failed to load issue details',
      historiesLoadFailed: 'Failed to load execution history',
      logsLoadFailed: 'Failed to load execution logs',
      retryFailed: 'Failed to retry execution',
      retrySuccess: 'Agent "{{name}}" reset to pending execution',
      notFound: 'Issue not found',
      empty: 'No execution history',
      logsSectionTitle: 'logs',
      logsSectionEmpty: 'No log content',
      actions: {
        viewLogs: 'Logs',
        viewInput: 'View input',
        viewOutput: 'View output',
        retry: 'Retry',
        refreshLogs: 'Refresh logs',
        downloadLogs: 'Download logs'
      },
      states: {
        logsRefreshing: 'Refreshing...',
        logsLoading: 'Loading logs...',
        retrying: 'Retrying...'
      },
      table: {
        agent: 'Agent',
        executeClient: 'Execution client',
        status: 'Status',
        inputTokens: 'Input tokens',
        outputTokens: 'Output tokens',
        startedAt: 'Started at',
        finishedAt: 'Finished at',
        actions: 'Actions'
      },
      status: {
        created: 'Created',
        queued: 'Queued',
        running: 'Running',
        success: 'Success',
        failure: 'Failure',
        blocked: 'Blocked'
      },
      logsDialog: {
        titleWithAgent: '{{name}} logs',
        titleFallback: 'Execution logs'
      },
      rawDialog: {
        titleInputWithAgent: '{{name}} input',
        titleOutputWithAgent: '{{name}} output',
        titleFallback: 'Raw content',
        sectionTitleInput: 'input',
        sectionTitleOutput: 'output',
        emptyInput: 'No raw input content',
        emptyOutput: 'No raw output content'
      },
      retryDialog: {
        title: 'Reset execution?',
        descriptionWithAgent:
          'This resets the current execution record for agent "{{name}}" to pending without creating a new record.',
        descriptionFallback:
          'This resets the current execution record to pending without creating a new record.'
      }
    },
    workflows: {
      loadFailed: 'Failed to load workflows',
      saveFailed: 'Failed to save workflow',
      updateNameSuccess: 'Workflow name updated',
      createSuccess: 'Workflow created',
      deleteFailed: 'Failed to delete workflow',
      deleteSuccess: 'Workflow "{{name}}" deleted',
      toggleFailed: 'Failed to update workflow status',
      enabledSuccess: 'Workflow enabled',
      disabledSuccess: 'Workflow disabled',
      validation: {
        nameRequired: 'Enter a workflow name'
      },
      empty: 'No workflow data',
      actions: {
        create: 'New workflow',
        edit: 'Edit',
        configureNodes: 'Node settings',
        delete: 'Delete',
        save: 'Save',
        createSubmit: 'Create'
      },
      status: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        enableAria: 'Enable workflow {{name}}',
        disableAria: 'Disable workflow {{name}}'
      },
      table: {
        index: 'No.',
        name: 'Workflow name',
        status: 'Status',
        actions: 'Actions'
      },
      dialog: {
        editTitle: 'Edit workflow name',
        createTitle: 'New workflow',
        editDescription:
          'Update the display name shown in the list without affecting existing execution node settings.',
        createDescription:
          'Create a workflow first, then configure its trigger conditions and execution nodes.',
        nameLabel: 'Workflow name',
        namePlaceholder: 'Enter a workflow name',
        saving: 'Saving...',
        creating: 'Creating...'
      },
      deleteDialog: {
        title: 'Delete workflow?',
        descriptionWithName:
          'Workflow "{{name}}" cannot be restored after deletion, and its related execution nodes will be deleted as well.',
        descriptionFallback: 'A workflow cannot be restored after deletion.'
      }
    },
    agents: {
      loadFailed: 'Failed to load agents',
      createFailed: 'Failed to create agent',
      duplicateFailed: 'Failed to duplicate agent',
      duplicateName: '{{name}} Copy',
      duplicateSuccess: 'Agent "{{name}}" duplicated',
      deleteFailed: 'Failed to delete agent',
      deleteSuccess: 'Agent "{{name}}" deleted',
      empty: 'No agent data',
      actions: {
        create: 'New agent',
        configure: 'Configure',
        duplicate: 'Duplicate',
        delete: 'Delete'
      },
      table: {
        index: 'No.',
        name: 'Agent name',
        workspace: 'Workspace',
        executor: 'Executor',
        skills: 'Skills',
        actions: 'Actions'
      },
      deleteDialog: {
        title: 'Delete agent?',
        descriptionWithName:
          'Agent "{{name}}" cannot be restored after deletion. If it is still referenced by any workflow, deletion will be blocked.',
        descriptionFallback: 'An agent cannot be restored after deletion.'
      }
    },
    agentDetail: {
      missingUuid: 'Agent uuid is missing',
      draftLoadFailed: 'Failed to load agent configuration',
      promptPreviewLoadFailed: 'Failed to load prompt preview',
      onesFieldsLoadFailed: 'Failed to load ONES fields',
      resourcesLoadFailed: 'Failed to load agent bindings',
      workspacesLoadFailed: 'Failed to load workspaces',
      skillsLoadFailed: 'Failed to load skills',
      executorSearchFailed: 'Failed to search executors',
      basicConfigSaveFailed: 'Failed to save agent basic settings',
      draftSaveFailed: 'Failed to save draft',
      publishFailed: 'Failed to publish agent configuration',
      publishSuccess: 'Agent configuration published',
      validation: {
        nameRequired: 'Enter an agent name'
      },
      duplicateInputField: 'An input binding already exists for top-level field "{{name}}"',
      duplicateOutputField: 'An output binding already exists for top-level field "{{name}}"',
      steps: {
        basic: 'Basic settings',
        inputs: 'Input settings',
        outputs: 'Output settings',
        prompt: 'Prompt'
      },
      actions: {
        previewPrompt: 'Prompt preview',
        previousStep: 'Previous',
        nextStep: 'Next',
        edit: 'Edit',
        publish: 'Publish',
        confirm: 'Confirm'
      },
      basic: {
        nameLabel: 'Name',
        namePlaceholder: 'Enter an agent name',
        executorLabel: 'Executor',
        executorPlaceholder: 'Search ONES users',
        executorSearchLoading: 'Searching...',
        executorEmpty: 'No matching ONES users',
        executorSearchHint: 'Search by name, email, or staff ID',
        executorHelpLabel: 'Executor',
        executorHelpContent:
          'When left empty, execution results are not bound to any specific ONES user identity.',
        workspaceLabel: 'Workspace',
        workspacePlaceholderLoading: 'Loading workspaces...',
        workspacePlaceholder: 'Optional, no workspace selected',
        workspaceEmpty: 'No workspaces available. You can leave this empty.',
        workspaceHelpLabel: 'Workspace',
        workspaceHelpContent:
          'The workspace can be left empty for agents that do not depend on a local code repository.',
        skillsLabel: 'Skills',
        skillsPlaceholder: 'Search or select skills',
        skillsEmpty: 'No bindable skills'
      },
      fields: {
        pickerPlaceholder: 'Search or select a field',
        pickerEmpty: 'No fields available',
        addField: 'Add field',
        empty: 'No fields yet. Select a field above first.',
        emptySubFields: 'No internal fields yet. Add a field first.',
        emptyOutputSubFields:
          'No internal fields yet. After adding them, the agent will generate the inner Issue object fields based on these descriptions.',
        table: {
          name: 'Field name',
          description: 'Field description',
          actions: 'Actions'
        },
        preview: {
          noSubFieldDescriptions: 'No internal field descriptions configured yet',
          noDescription: 'No description provided'
        },
        internalFieldSummaryTitle: '{{fieldName}} internal field descriptions',
        inputDescriptionPlaceholder: 'Describe how this input field is used by the agent',
        inputSubFieldDescriptionPlaceholder:
          'Describe how this internal field is used by the agent',
        outputDescriptionPlaceholderObject:
          'Describe what this output field should do overall, for example create, update, or create/update an Issue object',
        outputDescriptionPlaceholderSimple:
          'Describe how this output field is used by the agent',
        outputSubFieldDescriptionPlaceholder:
          'Describe how this internal field should be written back',
        editInternalFieldSummaryTitle:
          'Edit {{fieldName}} internal field descriptions',
        outputSubFieldDialogDescription:
          'The top-level field description is edited in the outer table. This dialog only maintains the Issue object internal fields and their descriptions.',
        inputSubFieldUnsupported:
          'This field is not an issue reference field, so internal fields cannot be configured.',
        outputSubFieldUnsupported:
          'This field is not an Issue reference field, so internal fields are not needed.',
        moveUpAria: 'Move field {{name}} up',
        moveDownAria: 'Move field {{name}} down'
      },
      prompt: {
        placeholder:
          'For example: You are an assistant skilled at requirement analysis. Generate content based on the input fields...'
      },
      preview: {
        title: 'Prompt preview',
        description:
          'This view shows the final content assembled from input fields, output fields, and the prompt.',
        panelTitle: 'Prompt preview',
        loading: 'Generating preview...'
      },
      publishDialog: {
        title: 'Publish configuration',
        description:
          'Publishing saves the current configuration as a new version and makes it effective immediately. Continue?',
        publishing: 'Publishing...',
        confirm: 'Confirm publish'
      }
    },
    members: {
      loadFailed: 'Failed to load members',
      searchFailed: 'Failed to search ONES users',
      addFailed: 'Failed to add member',
      addSuccess: 'Member "{{name}}" added',
      removeFailed: 'Failed to remove member',
      removeSuccess: 'Member "{{name}}" removed',
      selectUserRequired: 'Select a ONES user',
      empty: 'No members',
      actions: {
        add: 'Add member',
        remove: 'Remove',
        confirmAdd: 'Confirm add',
        adding: 'Adding...',
        confirmRemove: 'Confirm remove',
        removing: 'Removing...'
      },
      table: {
        name: 'Name',
        email: 'Email',
        staffId: 'Staff ID',
        userUuid: 'User UUID',
        createdAt: 'Added at',
        actions: 'Actions'
      },
      dialog: {
        title: 'Add member',
        description:
          'Select a ONES user account and add it to the AI Workflow member list for the current team.',
        userLabel: 'ONES user',
        searchPlaceholderLoading: 'Searching ONES users...',
        searchPlaceholder: 'Search by name, email, or staff ID',
        searchEmptyLoading: 'Searching...',
        searchEmpty: 'No matching ONES users',
        selectedName: 'Name: {{value}}',
        selectedEmail: 'Email: {{value}}',
        selectedStaffId: 'Staff ID: {{value}}'
      },
      deleteDialog: {
        title: 'Remove member',
        description:
          'Remove member "{{name}}"? After removal, this account will no longer be able to access AI Workflow for the current team.'
      }
    },
    agentWorkspaces: {
      loadFailed: 'Failed to load workspaces',
      saveFailed: 'Failed to save workspace',
      updateSuccess: 'Workspace updated',
      createSuccess: 'Workspace created',
      deleteFailed: 'Failed to delete workspace',
      deleteSuccess: 'Workspace "{{name}}" deleted',
      validation: {
        nameRequired: 'Enter a workspace name'
      },
      empty: 'No workspaces yet. Create one first.',
      actions: {
        create: 'New workspace',
        edit: 'Edit',
        repositories: 'Repositories',
        credentials: 'Credentials',
        delete: 'Delete',
        save: 'Save'
      },
      table: {
        workspace: 'Workspace',
        repositories: 'Repositories',
        credentials: 'Credentials',
        actions: 'Actions',
        repositoryCount: '{{count}}',
        credentialCount: '{{count}}'
      },
      dialog: {
        createTitle: 'New workspace',
        editTitle: 'Edit workspace',
        nameLabel: 'Name',
        namePlaceholder: 'Example: Default workspace'
      },
      deleteDialog: {
        title: 'Delete workspace?',
        description:
          'Deleting a workspace also removes all repository settings under it. This cannot be undone.'
      }
    },
    agentWorkspaceCredentials: {
      missingUuid: 'Missing workspace uuid',
      pageTitle: 'Workspace credentials',
      notFound: 'Workspace not found',
      loadFailed: 'Failed to load workspace credentials',
      saveFailed: 'Failed to save credential',
      saveSuccess: 'Credential saved',
      deleteFailed: 'Failed to delete credential',
      deleteSuccess: 'Credential deleted',
      empty: 'No credentials yet. Added credentials will be injected as environment variables during task execution.',
      actions: {
        create: 'New credential',
        delete: 'Delete',
        save: 'Save'
      },
      table: {
        envName: 'Variable name',
        description: 'Description',
        updatedAt: 'Updated at',
        actions: 'Actions'
      },
      dialog: {
        title: 'New credential',
        envNameLabel: 'Environment variable name',
        envNamePlaceholder: 'OPENAI_API_KEY',
        envNameDescription:
          'Must start with an uppercase letter and only contain A-Z, 0-9, and _. Existing credentials with the same name will be overwritten.',
        valueLabel: 'Credential value',
        valuePlaceholder: 'sk-...',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Used to call the OpenAI API'
      },
      validation: {
        envNameRequired: 'Enter an environment variable name',
        envNameInvalid:
          'The name must start with an uppercase letter and only contain A-Z, 0-9, and _',
        valueRequired: 'Enter a credential value',
        descriptionTooLong: 'Description must be at most 256 characters'
      },
      deleteDialog: {
        title: 'Delete credential?',
        description:
          'After deletion, this environment variable will no longer be injected during task execution.'
      }
    },
    skills: {
      loadFailed: 'Failed to load skills',
      downloadFailed: 'Failed to download skill',
      uploadFailed: 'Failed to upload skill',
      uploadSuccess: 'Skill uploaded',
      uploadVersionFailed: 'Failed to upload a new skill version',
      uploadVersionSuccess: 'New skill version uploaded',
      deleteFailed: 'Failed to delete skill',
      deleteSuccess: 'Skill "{{name}}" deleted',
      empty: 'No skill data',
      validation: {
        filesRequired: 'Select a directory'
      },
      actions: {
        upload: 'Upload skill',
        download: 'Download',
        uploadVersion: 'Upload new version',
        delete: 'Delete',
        startUpload: 'Start upload',
        confirmUpload: 'Upload'
      },
      table: {
        name: 'Name',
        description: 'Description',
        currentVersion: 'Current version',
        updatedAt: 'Updated at',
        actions: 'Actions'
      },
      dialog: {
        createTitle: 'Upload skill',
        createDescription:
          'Select a skill directory to upload. The directory contents must follow the skill specification.',
        uploadTitle: 'Upload new skill version',
        uploadDescriptionWithName:
          'Upload a new directory package for {{name}}. The system will re-extract metadata from SKILL.md.',
        uploadDescriptionFallback:
          'Upload a new directory package. The system will re-extract metadata from SKILL.md.',
        directoryLabel: 'Skill directory',
        selectedFiles: '{{count}} files selected'
      },
      deleteDialog: {
        title: 'Delete skill',
        descriptionWithName:
          'Delete skill "{{name}}"? This deletes all versions and local storage files for the skill.',
        descriptionFallback: 'Delete this skill?'
      }
    },
    workflowDetail: {
      missingUuid: 'Missing workflow uuid',
      pageTitle: 'Workflow',
      loadFailed: 'Failed to load workflow details',
      optionsLoadFailed: 'Failed to load selector data',
      projectsLoadFailed: 'Failed to load projects',
      issueTypesLoadFailed: 'Failed to load issue types',
      statusesLoadFailed: 'Failed to load statuses',
      agentsLoadFailed: 'Failed to load agents',
      createNodeFailed: 'Failed to create execution node',
      updateNodeFailed: 'Failed to update execution node',
      createNodeSuccess: 'Execution node created',
      updateNodeSuccess: 'Execution node updated',
      deleteNodeFailed: 'Failed to delete execution node',
      deleteNodeSuccess: 'Execution node deleted',
      empty: 'No execution nodes',
      validation: {
        projectRequired: 'Select a project',
        issueTypeRequired: 'Select an issue type',
        statusRequired: 'Select a status',
        agentRequired: 'Select an agent',
        incompleteSelection: 'The form data is incomplete. Reselect the options and try again.'
      },
      actions: {
        createNode: 'New execution node',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        create: 'Create'
      },
      table: {
        index: 'No.',
        project: 'Project',
        issueType: 'Issue type',
        status: 'Status',
        agent: 'Bound agent',
        actions: 'Actions'
      },
      dialog: {
        createTitle: 'New execution node',
        editTitle: 'Edit execution node',
        createDescription:
          'Configure which project, issue type, and status trigger this node, then choose the agent to execute.',
        editDescription:
          'Update the project, issue type, status, and bound agent for this execution node.',
        projectLabel: 'Project',
        projectPlaceholderLoading: 'Loading projects...',
        projectPlaceholder: 'Search or select a project',
        projectEmpty: 'No projects available',
        issueTypeLabel: 'Issue type',
        issueTypePlaceholderLoading: 'Loading issue types...',
        issueTypePlaceholder: 'Search or select an issue type',
        issueTypeEmpty: 'No issue types available',
        statusLabel: 'Status',
        statusPlaceholderLoading: 'Loading statuses...',
        statusPlaceholder: 'Search or select a status',
        statusEmpty: 'No statuses available',
        agentLabel: 'Agent',
        agentPlaceholderLoading: 'Loading agents...',
        agentPlaceholder: 'Search or select an agent',
        agentEmpty: 'No matching agents',
        saving: 'Saving...',
        creating: 'Creating...'
      },
      deleteDialog: {
        title: 'Delete execution node?',
        description:
          'This cannot be undone. The project, issue type, status, and bound agent for this node will all be removed.'
      }
    },
    agentWorkspaceRepositories: {
      missingUuid: 'Missing workspace uuid',
      pageTitle: 'Workspace repositories',
      notFound: 'Workspace not found.',
      loadFailed: 'Failed to load workspace details',
      workspaceListLoadFailed: 'Failed to load workspaces',
      saveRepositoryFailed: 'Failed to save repository',
      updateRepositorySuccess: 'Repository updated',
      createRepositorySuccess: 'Repository created',
      createRepositoriesSuccess: '{{count}} repositories created',
      deleteRepositoryFailed: 'Failed to delete repository',
      deleteRepositorySuccess: 'Repository deleted',
      saveAuthFailed: 'Failed to save authentication',
      saveAuthSuccess: 'Authentication updated',
      copyPublicKeyUnavailable: 'There is no SSH public key available to copy for this workspace',
      copyPublicKeySuccess: 'SSH public key copied',
      copyPublicKeyFailed: 'Failed to copy SSH public key',
      generateSshKeyFailed: 'Failed to generate SSH key',
      generateSshKeySuccess: 'SSH key generated',
      regenerateSshKeySuccess: 'SSH key updated',
      empty: 'No repositories yet. Add one first.',
      validation: {
        repositoryUrlRequired: 'Enter a repository URL',
        repositoryUrlListRequired: 'Enter at least one repository URL',
        repositoryUrlInvalid: 'Each line must contain a valid Git SSH or HTTPS URL',
        httpsUsernameRequired: 'Enter an HTTPS username',
        sshUrlOnly: 'This workspace uses SSH auth, so only Git SSH URLs are allowed.',
        httpsUrlOnly: 'This workspace uses HTTPS auth, so only HTTPS repository URLs are allowed.',
        publicHttpsUrlOnly:
          'This workspace has no auth configured, so only public HTTPS repository URLs are allowed.'
      },
      actions: {
        createRepository: 'New repository',
        authSettings: 'Auth settings',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        copyPublicKey: 'Copy public key',
        copied: 'Copied',
        generateKey: 'Generate key',
        regenerateKey: 'Regenerate'
      },
      table: {
        url: 'Repository URL',
        browseUrl: 'Browse URL',
        actions: 'Actions',
        browseUrlUnavailable: 'Unavailable'
      },
      repositoryDialog: {
        createTitle: 'New repository',
        editTitle: 'Edit repository',
        urlListLabel: 'Repository URLs (one per line)',
        urlLabel: 'Repository URL'
      },
      authDialog: {
        title: 'Auth settings',
        typeLabel: 'Auth type',
        typePlaceholder: 'Select an auth type',
        typeNone: 'No auth (public HTTPS repositories)',
        typeSsh: 'SSH public key',
        typeHttps: 'HTTPS username + secret',
        sshPublicKeyLabel: 'SSH public key',
        sshPublicKeyPlaceholder: 'No SSH public key has been generated yet',
        sshPublicKeyDescription:
          'Add this public key to the target repository as a deploy key or read-only key.',
        usernameLabel: 'Username',
        usernamePlaceholder: 'Example: git-bot',
        usernameDescription:
          'Typical values are a Git username, service account name, or fixed placeholder username.',
        secretLabel: 'Secret',
        secretPlaceholder: 'Enter a token, PAT, or compatible password',
        secretDescriptionKeep: 'Leave empty to keep the currently saved secret.',
        secretDescriptionRequired: 'Enter a secret that can be used for Git HTTPS access.'
      },
      authDescription: {
        ssh: 'Use this for SSH repositories accessed with a deploy key or machine account.',
        https:
          'Use this for private HTTPS repositories accessed with a username and token/PAT/password.',
        none:
          'Use this only for public HTTPS repositories. No extra authentication details will be provided.'
      },
      repositoryInputDescription: {
        ssh:
          'This workspace uses SSH auth, so only `git@...` or `ssh://...` repository URLs can be added.',
        https:
          'This workspace uses HTTPS auth, so only `https://...` repository URLs can be added.',
        none:
          'This workspace has no auth configured, so only public `https://...` repository URLs can be added.'
      },
      generateSshKeyDialog: {
        titleGenerate: 'Generate SSH key?',
        titleRegenerate: 'Regenerate SSH key?',
        descriptionGenerate:
          'After generation, you can add the new public key to the target Git repository as a deploy key.',
        descriptionRegenerate:
          'After regeneration, the old private key stops working immediately. You need to reconfigure the new public key in every Git repository using this workspace.',
        confirmGenerate: 'Generate',
        confirmRegenerate: 'Regenerate'
      },
      deleteDialog: {
        title: 'Delete repository?',
        description:
          'This removes the repository setting from the workspace but does not affect the remote repository itself.'
      }
    },
    placeholder: {
      description: 'Empty page placeholder'
    }
  }
} as const;
