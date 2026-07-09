export const jaJP = {
  app: {
    loading: "アプリケーションを読み込んでいます...",
    teamLoadFailed: "チームのロードに失敗しました",
    accessLoadFailed: "権限の読み込みに失敗しました",
    noAvailableTeam: "現在のアカウントで利用できるチームはありません"
  },
  common: {
    actions: {
      refresh: "リフレッシュ",
      cancel: "キャンセル",
      done: "完了",
      confirmDelete: "削除の確認",
      retry: "更新後に再試行してください"
    },
    states: {
      loading: "読み込み中...",
      deleting: "削除中..."
    },
    fallback: {
      currentUser: "現在のユーザー",
      emptyValue: "-",
      error: "操作に失敗しました。しばらくしてからもう一度お試しください。"
    }
  },
  apiErrors: {
    codes: {
      "auth.user_not_logged_in": "セッションの有効期限が切れました。再度サインインしてください。",
      "auth.missing_authorization_header": "セッションの有効期限が切れました。再度サインインしてください。",
      "auth.invalid_authorization_token": "サインイン トークンが無効です。再度サインインしてください。",
      "auth.organization_identifier_missing": "サインイン トークンに組織情報がありません。再度サインインしてください。",
      "auth.team_uuid_required": "チームのコンテキストが欠落しています。チームを選択してもう一度お試しください。",
      "auth.selected_team_not_accessible": "選択したチームにはアクセスできません。別のチームを選択して、もう一度お試しください。",
      "access.not_app_member": "あなたのアカウントは、現在のチームの AI ワークフローのメンバーではありません。管理者に追加を依頼してください。",
      "access.admin_only": "このページは管理者のみが利用できます。",
      "common.internal_server_error": "内部サーバーエラー。後でもう一度試してください。",
      "common.route_not_found": "要求されたエンドポイントが見つかりませんでした。",
      "skills.invalid_payload": "スキルリクエストのペイロードが無効です。",
      "skills.invalid_package_payload": "スキルパッケージが無効です。ディレクトリ構造とSKILL.mdを確認してください。",
      "skills.uuid_required": "スキル識別子がありません。",
      "skills.version_invalid": "スキルのバージョンが無効です。",
      "skills.not_found": "要求されたスキルが見つかりませんでした。",
      "skills.conflict": "同名のスキルが既に存在します。",
      "skills.in_use": "このスキルは依然としてエージェントによって参照されているため、削除できません。",
      "agent_clients.invalid_connect_payload": "エージェント クライアント接続要求ペイロードが無効です。",
      "agent_clients.invalid_connect_poll_payload": "エージェント クライアントのポーリング リクエスト ペイロードが無効です。",
      "agent_clients.invalid_connection_request": "エージェント クライアント接続リクエストは無効になりました。新しい接続リクエストを開始します。",
      "agent_clients.uuid_required": "エージェントのクライアント識別子がありません。",
      "agent_clients.not_found": "要求されたエージェント クライアントが見つかりませんでした。",
      "executions.dispatched_issue_uuid_required": "課題実行レコード識別子がありません。",
      "executions.dispatched_issue_not_found": "要求された課題実行レコードが見つかりませんでした。",
      "executions.issue_execution_history_uuid_required": "実行履歴識別子がありません。",
      "executions.issue_execution_history_not_found": "要求された実行履歴が見つかりませんでした。",
      "executions.issue_agent_execution_history_uuid_required": "エージェント実行履歴識別子がありません。",
      "executions.issue_agent_execution_history_not_found": "要求されたエージェントの実行履歴が見つかりませんでした。",
      "executions.issue_agent_execution_retry_not_allowed": "現在のエージェント実行レコードを再試行することはできません。更新して再試行してください。",
      "workflows.uuid_required": "ワークフロー識別子がありません。",
      "workflows.invalid_payload": "ワークフロー リクエストのペイロードが無効です。",
      "workflows.not_found": "要求されたワークフローが見つかりませんでした。",
      "workflows.node_uuid_required": "ワークフロー ノード識別子がありません。",
      "workflows.invalid_node_payload": "ワークフロー ノードのペイロードが無効です。",
      "workflows.node_not_found": "要求されたワークフロー ノードが見つかりませんでした。",
      "workflows.node_executor_invalid": "ワークフロー ノード上のエージェント バインドが無効です。",
      "workflows.deletion_blocked": "このワークフローにはまだ実行ノードが含まれています。ワークフローを削除する前に、これらのノードを削除してください。",
      "agents.invalid_payload": "エージェント要求ペイロードが無効です。",
      "agents.invalid_prompt_preview_payload": "プロンプト プレビュー ペイロードが無効です。",
      "agents.invalid_draft_payload": "エージェントのドラフト ペイロードが無効です。",
      "agents.invalid_publish_payload": "エージェントのパブリッシュ ペイロードが無効です。",
      "agents.workspace_binding_not_found": "バインドされたエージェント ワークスペースが見つかりませんでした。",
      "agents.skill_binding_not_found": "バインドされたエージェント スキルが見つかりませんでした。",
      "agents.conflict": "エージェントのデータが競合しています。更新して再試行してください。",
      "agents.uuid_required": "エージェント識別子がありません。",
      "agents.not_found": "要求されたエージェントが見つかりませんでした。",
      "agents.draft_not_found": "このエージェントに対して公開できるドラフト構成はありません。",
      "agents.in_use": "このエージェントは依然としてワークフローによって参照されているため、削除できません。",
      "members.invalid_payload": "メンバーリクエストのペイロードが無効です。",
      "members.conflict": "このメンバーはすでに存在します。",
      "members.user_uuid_required": "メンバーのユーザー識別子がありません。",
      "members.not_found": "要求されたメンバーが見つかりませんでした。",
      "ones.config_error": "ONES 統合構成が無効です。管理者に確認を依頼してください。",
      "ones.request_error": "ONES サービスのリクエストに失敗しました。後でもう一度試してください。",
      "ones.response_error": "ONES サービスは処理できない応答を返しました。後でもう一度試してください。",
      "ones.invalid_user_search_query": "ONES ユーザーの検索クエリが無効です。",
      "agent_workspaces.invalid_payload": "ワークスペースリクエストのペイロードが無効です。",
      "agent_workspaces.uuid_required": "ワークスペース識別子がありません。",
      "agent_workspaces.not_found": "要求されたワークスペースが見つかりませんでした。",
      "agent_workspaces.in_use": "このワークスペースは依然としてエージェントによって参照されているため、削除できません。",
      "agent_workspaces.auth_conflict": "現在のワークスペース認証構成は、この操作と互換性がありません。",
      "agent_workspaces.repository_uuid_required": "リポジトリ識別子がありません。",
      "agent_workspaces.invalid_repository_payload": "リポジトリ リクエストのペイロードが無効です。",
      "agent_workspaces.repository_not_found": "要求されたリポジトリが見つかりませんでした。",
      "agent_workspaces.invalid_auth_payload": "ワークスペース認証ペイロードが無効です。",
      "agent_workspaces.invalid_credential_payload": "ワークスペース資格情報ペイロードが無効です。",
      "agent_workspaces.credential_env_name_required": "資格情報の環境変数名がありません。",
      "agent_workspaces.credential_not_found": "要求されたワークスペース資格情報が見つかりませんでした。"
    }
  },
  language: {
    label: "言語",
    options: {
      "zh-CN": "簡体字中国語",
      "en-US": "英語",
      "ja-JP": "日本語"
    }
  },
  navigation: {
    groups: {
      aiWorkflow: "AI ワークフロー",
      agentDesign: "エージェントの設計",
      adminSettings: "管理者設定"
    },
    items: {
      workflowExecution: "ワークフローの実行",
      workflowDesign: "ワークフローの設計",
      agentConfig: "エージェント構成",
      modelProfiles: "モデル構成",
      agentSkills: "エージェントのスキル",
      agentWorkspaces: "エージェントワークスペース",
      agentClients: "エージェントクライアント",
      members: "メンバー"
    }
  },
  header: {
    titles: {
      dashboard: "ダッシュボード",
      workflowExecution: "ワークフローの実行",
      workflowDesign: "ワークフローの設計",
      agentConfig: "エージェント構成",
      modelProfiles: "モデル構成",
      agentClients: "エージェントクライアント",
      agentWorkspaces: "エージェントワークスペース",
      agentSkills: "エージェントのスキル"
    },
    descriptions: {
      workflowExecution: "ワークフローによってトリガーされた実行レコードを表示し、各実行の最新ステータスを追跡します。",
      workflowDesign: "ONES ワークフローをエージェントに接続して、エージェントがビジネス フローの実行に参加できるようにします。",
      agentConfig: "プロンプト、実行 ID、ワークスペース、バインドされたスキルなどの基本エージェント設定を定義します。",
      modelProfiles: "各エージェントが個別に選択できる再利用可能な AI モデル構成を管理します。",
      agentWorkspaces: "タスクを実行するために必要なワークスペース、リポジトリ、およびランタイム環境をエージェントに提供します。",
      agentSkills: "エージェントに再利用可能な機能、知識、および実行ルールを提供します。"
    }
  },
  permissionDenied: {
    title: {
      adminOnly: "管理者のみ",
      notAppMember: "現在のチームにいない",
      missingOrgAdmin: "AI ワークフローにアクセスできない"
    },
    description: {
      adminOnly: "このページは管理者のみがアクセスできるため、アクセスがブロックされています。",
      notAppMember: "あなたのアカウントはまだこのチームの AI ワークフローのメンバーではないため、アクセスはブロックされています。",
      missingOrgAdmin: "お使いのアカウントには、このアプリを使用するために必要な組織レベルの権限がないため、アクセスがブロックされました。"
    },
    hint: {
      adminOnly: "エージェントのクライアントまたはメンバーを管理する必要がある場合は、組織管理者に問い合わせてください。",
      notAppMember: "このチームの AI ワークフロー メンバーにあなたを追加するように管理者に依頼してから、更新して再試行してください。",
      missingOrgAdmin: "管理者にアカウントにアプリケーション管理者権限を付与するよう依頼し、ページをリロードしてください。"
    },
    requiredPermission: "必要な許可"
  },
  teamSwitcher: {
    loading: "チームを読み込んでいます...",
    error: "チームのロードに失敗しました",
    empty: "チームがありません",
    label: "チームを選択"
  },
  searchSelect: {
    placeholder: "検索または選択",
    empty: "一致するものが見つかりませんでした",
    overflowFiltered: "結果が多すぎます。最初の {{count}} アイテムを表示しています。入力を続けて絞り込みます。",
    overflowUnfiltered: "最初の {{count}} アイテムを表示しています。さらに多くの結果を検索するには、キーワードを入力します。"
  },
  pages: {
    agentClients: {
      loadFailed: "エージェントクライアントのロードに失敗しました",
      approveFailed: "エージェントクライアントの承認に失敗しました",
      approveSuccess: "エージェントクライアント「{{name}}」が承認されました",
      revokeFailed: "エージェントクライアントの取り消しに失敗しました",
      revokeSuccess: "エージェントクライアント「{{name}}」が取り消されました",
      empty: "エージェントクライアントデータなし",
      table: {
        name: "名前",
        hostname: "ホスト",
        uuid: "UUID",
        version: "バージョン",
        connectionStatus: "接続状態",
        runtimeStatus: "稼働状態",
        lastExchangeAt: "最終通信",
        actions: "アクション"
      },
      actions: {
        add: "エージェントクライアントを追加",
        approve: "承認する",
        revoke: "取り消す",
        copy: "コピー",
        copied: "コピー済み",
        reset: "リセット"
      },
      addDialog: {
        title: "エージェントクライアントを追加",
        description: "エージェントクライアントの起動設定を生成します。起動後、クライアントは接続を申請し、管理者が承認した後にタスクを取得します。",
        serverBaseUrlLabel: "サーバー URL",
        serverBaseUrlDescription: "エージェントクライアントから到達できるプラグインバックエンド URL です。別のマシンで実行する場合はネットワーク到達性を確認してください。",
        clientUUIDLabel: "Client UUID",
        clientNameLabel: "Client 名称",
        concurrencyLabel: "タスク同時実行数",
        workingRootLabel: "作業ディレクトリ",
        localTab: "ローカル",
        dockerTab: "Docker",
        envTab: ".env",
        localCommandLabel: "ローカル起動コマンド",
        dockerComposeLabel: "Docker Compose スニペット",
        envFileLabel: ".env 設定",
        copySuccess: "起動設定をコピーしました",
        copyFailed: "起動設定のコピーに失敗しました",
        afterStartTitle: "起動後の承認フロー",
        afterStartDescription: "設定を実行すると、エージェントクライアントはこの一覧に承認待ちとして表示されます。承認するとアクセストークンが発行され、タスクの実行を開始します。"
      },
      connectionStatus: {
        pending_approval: "承認待ち",
        approved: "承認済み",
        active: "アクティブ",
        revoked: "取り消し済み"
      },
      runtimeStatus: {
        online: "オンライン",
        offline: "オフライン"
      }
    },
    issues: {
      loadFailed: "課題の読み込みに失敗しました",
      deleteFailed: "実行記録の削除に失敗しました",
      deleteSuccess: "現在の課題の実行記録を削除しました",
      empty: "課題データがありません",
      table: {
        displayId: "ID",
        title: "タイトル",
        project: "プロジェクト",
        issueType: "タイプ",
        latestExecutionStatus: "最新の実行状況",
        lastDispatchedAt: "最終実行時刻",
        actions: "アクション"
      },
      actions: {
        history: "実行履歴",
        delete: "削除"
      },
      status: {
        created: "作成されました",
        executing: "実行中",
        success: "成功",
        failure: "失敗",
        blocked: "ブロックされました"
      },
      deleteDialog: {
        title: "実行記録を削除しますか?",
        descriptionWithIssue: "これにより、このシステム内の課題「{{name}}」の実行レコード、ログ、入出力スナップショットが削除されますが、ONES 内の課題自体は削除されません。",
        descriptionFallback: "このシステム内の現在の課題の実行記録を削除します。"
      }
    },
    issueDetail: {
      missingUuid: "課題 UUID がありません",
      pageTitle: "課題",
      loadFailed: "課題の詳細を読み込めませんでした",
      historiesLoadFailed: "実行履歴の読み込みに失敗しました",
      logsLoadFailed: "実行ログのロードに失敗しました",
      retryFailed: "実行の再試行に失敗しました",
      retrySuccess: "エージェント「{{name}}」が保留中の実行にリセットされました",
      notFound: "課題が見つかりません",
      empty: "実行履歴がありません",
      logsSectionTitle: "ログ",
      logsSectionEmpty: "ログ内容がありません",
      actions: {
        viewLogs: "ログ",
        viewInput: "入力を表示",
        viewOutput: "出力を表示する",
        retry: "リトライ",
        refreshLogs: "ログを更新する",
        downloadLogs: "ログをダウンロードする"
      },
      states: {
        logsRefreshing: "更新中...",
        logsLoading: "ログを読み込んでいます...",
        retrying: "再試行中..."
      },
      table: {
        agent: "エージェント",
        executeClient: "実行クライアント",
        status: "状態",
        inputTokens: "入力トークン",
        outputTokens: "出力トークン",
        startedAt: "開始時刻",
        finishedAt: "終了時刻",
        actions: "アクション"
      },
      status: {
        created: "作成されました",
        queued: "キューに入れられました",
        running: "実行中",
        success: "成功",
        failure: "失敗",
        blocked: "ブロックされました"
      },
      logsDialog: {
        titleWithAgent: "{{name}} ログ",
        titleFallback: "実行ログ"
      },
      rawDialog: {
        titleInputWithAgent: "{{name}}入力",
        titleOutputWithAgent: "{{name}} 出力",
        titleFallback: "生のコンテンツ",
        sectionTitleInput: "入力",
        sectionTitleOutput: "出力",
        emptyInput: "生の入力コンテンツがありません",
        emptyOutput: "生の出力コンテンツはありません"
      },
      retryDialog: {
        title: "実行をリセットしますか?",
        descriptionWithAgent: "これにより、新しいレコードを作成せずに、エージェント「{{name}}」の現在の実行レコードが保留状態にリセットされます。",
        descriptionFallback: "これにより、新しいレコードは作成されずに、現在の実行レコードが保留状態にリセットされます。"
      }
    },
    workflows: {
      loadFailed: "ワークフローの読み込みに失敗しました",
      saveFailed: "ワークフローの保存に失敗しました",
      updateNameSuccess: "ワークフロー名が更新されました",
      createSuccess: "ワークフローが作成されました",
      deleteFailed: "ワークフローの削除に失敗しました",
      deleteSuccess: "ワークフロー「{{name}}」が削除されました",
      toggleFailed: "ワークフローステータスの更新に失敗しました",
      enabledSuccess: "ワークフローの有効化",
      disabledSuccess: "ワークフローが無効になっています",
      validation: {
        nameRequired: "ワークフロー名を入力してください"
      },
      empty: "ワークフローデータがありません",
      actions: {
        create: "新しいワークフロー",
        edit: "編集",
        configureNodes: "ノード設定",
        delete: "削除",
        save: "保存",
        createSubmit: "作成する"
      },
      status: {
        enabled: "有効",
        disabled: "無効",
        enableAria: "ワークフローを有効にする {{name}}",
        disableAria: "ワークフローを無効にする {{name}}"
      },
      table: {
        index: "番号",
        name: "ワークフロー名",
        status: "状態",
        actions: "アクション"
      },
      dialog: {
        editTitle: "ワークフロー名の編集",
        createTitle: "新しいワークフロー",
        editDescription: "既存の実行ノード設定に影響を与えずに、リストに表示される表示名を更新します。",
        createDescription: "まずワークフローを作成し、次にそのトリガー条件と実行ノードを構成します。",
        nameLabel: "ワークフロー名",
        namePlaceholder: "ワークフロー名を入力してください",
        saving: "保存中...",
        creating: "作成..."
      },
      deleteDialog: {
        title: "ワークフローを削除しますか?",
        descriptionWithName: "ワークフロー「{{name}}」は削除後に復元できず、関連する実行ノードも削除されます。",
        descriptionFallback: "ワークフローを削除した後は復元できません。"
      }
    },
    agents: {
      loadFailed: "エージェントのロードに失敗しました",
      createFailed: "エージェントの作成に失敗しました",
      duplicateFailed: "エージェントの複製に失敗しました",
      duplicateName: "{{name}} コピー",
      duplicateSuccess: "エージェント「{{name}}」が複製されました",
      deleteFailed: "エージェントの削除に失敗しました",
      deleteSuccess: "エージェント「{{name}}」が削除されました",
      empty: "エージェントデータなし",
      actions: {
        create: "新しいエージェント",
        configure: "設定する",
        duplicate: "複製",
        delete: "削除"
      },
      table: {
        index: "番号",
        name: "エージェント名",
        workspace: "ワークスペース",
        executor: "実行者",
        skills: "スキル",
        actions: "アクション"
      },
      deleteDialog: {
        title: "エージェントを削除しますか?",
        descriptionWithName: "エージェント「{{name}}」は削除後に復元できません。ワークフローによってまだ参照されている場合、削除はブロックされます。",
        descriptionFallback: "エージェントを削除した後は復元できません。"
      }
    },
    agentDetail: {
      missingUuid: "エージェントの UUID がありません",
      draftLoadFailed: "エージェント構成のロードに失敗しました",
      promptPreviewLoadFailed: "プロンプト プレビューの読み込みに失敗しました",
      onesFieldsLoadFailed: "ONES フィールドのロードに失敗しました",
      resourcesLoadFailed: "エージェントバインディングのロードに失敗しました",
      workspacesLoadFailed: "ワークスペースのロードに失敗しました",
      skillsLoadFailed: "スキルのロードに失敗しました",
      executorSearchFailed: "実行者の検索に失敗しました",
      basicConfigSaveFailed: "エージェントの基本設定を保存できませんでした",
      draftSaveFailed: "下書きの保存に失敗しました",
      publishFailed: "エージェント構成の公開に失敗しました",
      publishSuccess: "エージェント構成が公開されました",
      validation: {
        nameRequired: "エージェント名を入力してください"
      },
      duplicateInputField: "最上位フィールド「{{name}}」には入力バインディングがすでに存在します。",
      duplicateOutputField: "最上位フィールド「{{name}}」には出力バインディングがすでに存在します。",
      steps: {
        basic: "基本設定",
        inputs: "入力設定",
        outputs: "出力設定",
        prompt: "プロンプト"
      },
      actions: {
        previewPrompt: "プロンプトプレビュー",
        previousStep: "前の",
        nextStep: "次",
        edit: "編集",
        publish: "公開",
        confirm: "確認する"
      },
      basic: {
        nameLabel: "名前",
        namePlaceholder: "エージェント名を入力してください",
        executorLabel: "実行者",
        executorPlaceholder: "ONESユーザーを検索",
        executorSearchLoading: "検索中...",
        executorEmpty: "一致する ONES ユーザーがいません",
        executorSearchHint: "名前、メールアドレス、スタッフIDで検索",
        executorHelpLabel: "実行者",
        executorHelpContent: "空のままにすると、実行結果は特定の ONES ユーザー ID にバインドされません。",
        workspaceLabel: "ワークスペース",
        workspacePlaceholderLoading: "ワークスペースを読み込んでいます...",
        workspacePlaceholder: "オプション、ワークスペースが選択されていません",
        workspaceEmpty: "利用可能なワークスペースがありません。これは空のままにすることができます。",
        workspaceHelpLabel: "ワークスペース",
        workspaceHelpContent: "ローカル コード リポジトリに依存しないエージェントの場合、ワークスペースは空のままにすることができます。",
        skillsLabel: "スキル",
        skillsPlaceholder: "スキルの検索または選択",
        skillsEmpty: "バインド可能なスキルはありません"
      },
      fields: {
        pickerPlaceholder: "フィールドを検索または選択します",
        pickerEmpty: "使用可能なフィールドがありません",
        addField: "フィールドの追加",
        empty: "まだフィールドがありません。まず上のフィールドを選択します。",
        emptySubFields: "まだ内部フィールドはありません。まずフィールドを追加します。",
        emptyOutputSubFields: "まだ内部フィールドはありません。これらを追加すると、エージェントはこれらの説明に基づいて内部の課題オブジェクト フィールドを生成します。",
        table: {
          name: "フィールド名",
          description: "フィールドの説明",
          actions: "アクション"
        },
        preview: {
          noSubFieldDescriptions: "内部フィールドの説明がまだ設定されていません",
          noDescription: "説明がありません"
        },
        internalFieldSummaryTitle: "{{fieldName}} の内部フィールドの説明",
        inputDescriptionPlaceholder: "この入力フィールドがエージェントによってどのように使用されるかを説明します",
        inputSubFieldDescriptionPlaceholder: "この内部フィールドがエージェントによってどのように使用されるかを説明します",
        outputDescriptionPlaceholderObject: "この出力フィールドが全体的に何を行うべきかを説明します。たとえば、課題オブジェクトの作成、更新、作成/更新などです。",
        outputDescriptionPlaceholderSimple: "この出力フィールドがエージェントによってどのように使用されるかを説明します",
        outputSubFieldDescriptionPlaceholder: "この内部フィールドを書き戻す方法を説明します。",
        editInternalFieldSummaryTitle: "{{fieldName}} の内部フィールドの説明を編集",
        outputSubFieldDialogDescription: "最上位フィールドの説明は外側のテーブルで編集します。このダイアログでは、Issue オブジェクトの内部フィールドとその説明のみを管理します。",
        inputSubFieldUnsupported: "このフィールドは Issue 参照フィールドではないため、内部フィールドを設定できません。",
        outputSubFieldUnsupported: "このフィールドは Issue 参照フィールドではないため、内部フィールドは不要です。",
        moveUpAria: "フィールド{{name}}を上に移動",
        moveDownAria: "フィールド {{name}} を下に移動します"
      },
      prompt: {
        placeholder: "例: あなたは要件分析が得意なアシスタントです。入力フィールドに基づいてコンテンツを生成します..."
      },
      preview: {
        title: "プロンプトプレビュー",
        description: "このビューには、入力フィールド、出力フィールド、およびプロンプトから組み立てられた最終的なコンテンツが表示されます。",
        panelTitle: "プロンプトプレビュー",
        loading: "プレビューを生成中..."
      },
      publishDialog: {
        title: "設定の公開",
        description: "公開すると、現在の設定が新しいバージョンとして保存され、すぐに有効になります。続行しますか？",
        publishing: "公開中...",
        confirm: "公開の確認"
      }
    },
    members: {
      loadFailed: "メンバーのロードに失敗しました",
      searchFailed: "ONES ユーザーの検索に失敗しました",
      addFailed: "メンバーの追加に失敗しました",
      addSuccess: "メンバー「{{name}}」を追加しました",
      removeFailed: "メンバーの削除に失敗しました",
      removeSuccess: "メンバー「{{name}}」が削除されました",
      selectUserRequired: "ONES ユーザーを選択してください",
      empty: "メンバーがいません",
      actions: {
        add: "メンバーを追加",
        remove: "取り除く",
        confirmAdd: "追加の確認",
        adding: "追加中...",
        confirmRemove: "削除の確認",
        removing: "削除中..."
      },
      table: {
        name: "名前",
        email: "電子メール",
        staffId: "スタッフID",
        userUuid: "ユーザーUUID",
        createdAt: "に追加されました",
        actions: "アクション"
      },
      dialog: {
        title: "メンバーを追加",
        description: "ONES ユーザー アカウントを選択し、現在のチームの AI Workflow メンバー リストに追加します。",
        userLabel: "ONESユーザー",
        searchPlaceholderLoading: "ONES ユーザーを検索しています...",
        searchPlaceholder: "名前、メールアドレス、スタッフIDで検索",
        searchEmptyLoading: "検索中...",
        searchEmpty: "一致する ONES ユーザーがいません",
        selectedName: "名前: {{value}}",
        selectedEmail: "メールアドレス: {{value}}",
        selectedStaffId: "スタッフID：{{value}}"
      },
      deleteDialog: {
        title: "メンバーの削除",
        description: "メンバー「{{name}}」を削除しますか?削除後、このアカウントは現在のチームの AI ワークフローにアクセスできなくなります。"
      }
    },
    agentWorkspaces: {
      loadFailed: "ワークスペースのロードに失敗しました",
      saveFailed: "ワークスペースの保存に失敗しました",
      updateSuccess: "ワークスペースが更新されました",
      createSuccess: "ワークスペースが作成されました",
      deleteFailed: "ワークスペースの削除に失敗しました",
      deleteSuccess: "ワークスペース「{{name}}」が削除されました",
      validation: {
        nameRequired: "ワークスペース名を入力してください"
      },
      empty: "まだワークスペースがありません。まず 1 つ作成します。",
      actions: {
        create: "新しいワークスペース",
        edit: "編集",
        repositories: "リポジトリ",
        credentials: "認証情報",
        delete: "削除",
        save: "保存"
      },
      table: {
        workspace: "ワークスペース",
        repositories: "リポジトリ",
        credentials: "認証情報",
        actions: "アクション",
        repositoryCount: "{{count}}",
        credentialCount: "{{count}}"
      },
      dialog: {
        createTitle: "新しいワークスペース",
        editTitle: "ワークスペースの編集",
        nameLabel: "名前",
        namePlaceholder: "例: デフォルトのワークスペース"
      },
      deleteDialog: {
        title: "ワークスペースを削除しますか?",
        description: "ワークスペースを削除すると、その下のリポジトリ設定もすべて削除されます。これを元に戻すことはできません。"
      }
    },
    agentWorkspaceCredentials: {
      missingUuid: "ワークスペース uuid がありません",
      pageTitle: "ワークスペースの認証情報",
      notFound: "ワークスペースが見つかりません",
      loadFailed: "ワークスペース資格情報のロードに失敗しました",
      saveFailed: "認証情報の保存に失敗しました",
      saveSuccess: "認証情報が保存されました",
      deleteFailed: "認証情報の削除に失敗しました",
      deleteSuccess: "資格情報が削除されました",
      empty: "まだ資格情報がありません。追加された資格情報は、タスクの実行中に環境変数として挿入されます。",
      actions: {
        create: "新しい資格情報",
        delete: "削除",
        save: "保存"
      },
      table: {
        envName: "変数名",
        description: "説明",
        updatedAt: "更新日時",
        actions: "アクション"
      },
      dialog: {
        title: "新しい資格情報",
        envNameLabel: "環境変数名",
        envNamePlaceholder: "OPENAI_API_KEY",
        envNameDescription: "大文字で始まり、A ～ Z、0 ～ 9、_ のみを含める必要があります。同じ名前の既存の資格情報は上書きされます。",
        valueLabel: "資格情報の値",
        valuePlaceholder: "sk-...",
        descriptionLabel: "説明",
        descriptionPlaceholder: "OpenAI APIを呼び出すために使用されます"
      },
      validation: {
        envNameRequired: "環境変数名を入力してください",
        envNameInvalid: "名前は大文字で始まり、A ～ Z、0 ～ 9、_ のみを含む必要があります。",
        valueRequired: "資格情報の値を入力してください",
        descriptionTooLong: "説明は最大 256 文字にする必要があります"
      },
      deleteDialog: {
        title: "認証情報を削除しますか?",
        description: "削除後、この環境変数はタスクの実行中に挿入されなくなります。"
      }
    },
    skills: {
      loadFailed: "スキルのロードに失敗しました",
      downloadFailed: "スキルのダウンロードに失敗しました",
      uploadFailed: "スキルのアップロードに失敗しました",
      uploadSuccess: "スキルをアップロードしました",
      uploadVersionFailed: "新しいスキルバージョンのアップロードに失敗しました",
      uploadVersionSuccess: "新しいスキルバージョンがアップロードされました",
      deleteFailed: "スキルの削除に失敗しました",
      deleteSuccess: "スキル「{{name}}」を削除しました",
      empty: "スキルデータなし",
      validation: {
        filesRequired: "ディレクトリを選択してください"
      },
      actions: {
        upload: "スキルのアップロード",
        download: "ダウンロード",
        uploadVersion: "新しいバージョンをアップロードする",
        delete: "削除",
        startUpload: "アップロードを開始する",
        confirmUpload: "アップロード"
      },
      table: {
        name: "名前",
        description: "説明",
        currentVersion: "現在のバージョン",
        updatedAt: "更新日時",
        actions: "アクション"
      },
      dialog: {
        createTitle: "スキルのアップロード",
        createDescription: "アップロードするスキル ディレクトリを選択します。ディレクトリの内容はスキル仕様に従う必要があります。",
        uploadTitle: "新しいスキルバージョンをアップロードする",
        uploadDescriptionWithName: "{{name}} の新しいディレクトリ パッケージをアップロードします。システムはSKILL.mdからメタデータを再抽出します。",
        uploadDescriptionFallback: "新しいディレクトリ パッケージをアップロードします。システムはSKILL.mdからメタデータを再抽出します。",
        directoryLabel: "スキルディレクトリ",
        selectedFiles: "{{count}} ファイルが選択されました"
      },
      deleteDialog: {
        title: "スキルの削除",
        descriptionWithName: "スキル「{{name}}」を削除しますか?これにより、スキルのすべてのバージョンとローカル ストレージ ファイルが削除されます。",
        descriptionFallback: "このスキルを削除しますか?"
      }
    },
    workflowDetail: {
      missingUuid: "ワークフロー UUID がありません",
      pageTitle: "ワークフロー",
      loadFailed: "ワークフローの詳細をロードできませんでした",
      optionsLoadFailed: "セレクターデータのロードに失敗しました",
      projectsLoadFailed: "プロジェクトのロードに失敗しました",
      issueTypesLoadFailed: "課題タイプをロードできませんでした",
      statusesLoadFailed: "ステータスの読み込みに失敗しました",
      agentsLoadFailed: "エージェントのロードに失敗しました",
      createNodeFailed: "実行ノードの作成に失敗しました",
      updateNodeFailed: "実行ノードの更新に失敗しました",
      createNodeSuccess: "実行ノードが作成されました",
      updateNodeSuccess: "実行ノードが更新されました",
      deleteNodeFailed: "実行ノードの削除に失敗しました",
      deleteNodeSuccess: "実行ノードが削除されました",
      empty: "実行ノードがありません",
      validation: {
        projectRequired: "プロジェクトを選択してください",
        issueTypeRequired: "課題タイプを選択してください",
        statusRequired: "ステータスを選択してください",
        agentRequired: "エージェントを選択してください",
        incompleteSelection: "フォームデータが不完全です。オプションを再選択して、再試行してください。"
      },
      actions: {
        createNode: "新しい実行ノード",
        edit: "編集",
        delete: "削除",
        save: "保存",
        create: "作成する"
      },
      table: {
        index: "番号",
        project: "プロジェクト",
        issueType: "課題タイプ",
        status: "状態",
        agent: "バインドされたエージェント",
        actions: "アクション"
      },
      dialog: {
        createTitle: "新しい実行ノード",
        editTitle: "実行ノードの編集",
        createDescription: "このノードをトリガーするプロジェクト、課題タイプ、ステータスを設定し、実行するエージェントを選択します。",
        editDescription: "この実行ノードのプロジェクト、課題タイプ、ステータス、およびバインドされたエージェントを更新します。",
        projectLabel: "プロジェクト",
        projectPlaceholderLoading: "プロジェクトを読み込んでいます...",
        projectPlaceholder: "プロジェクトを検索または選択します",
        projectEmpty: "利用可能なプロジェクトがありません",
        issueTypeLabel: "課題タイプ",
        issueTypePlaceholderLoading: "課題タイプを読み込んでいます...",
        issueTypePlaceholder: "課題タイプを検索または選択",
        issueTypeEmpty: "利用可能な課題タイプがありません",
        statusLabel: "状態",
        statusPlaceholderLoading: "ステータスを読み込み中...",
        statusPlaceholder: "ステータスを検索または選択します",
        statusEmpty: "利用可能なステータスがありません",
        agentLabel: "エージェント",
        agentPlaceholderLoading: "エージェントをロード中...",
        agentPlaceholder: "エージェントを検索または選択します",
        agentEmpty: "一致するエージェントがありません",
        saving: "保存中...",
        creating: "作成..."
      },
      deleteDialog: {
        title: "実行ノードを削除しますか?",
        description: "これを元に戻すことはできません。このノードのプロジェクト、課題タイプ、ステータス、およびバインドされたエージェントはすべて削除されます。"
      }
    },
    agentWorkspaceRepositories: {
      missingUuid: "ワークスペース uuid がありません",
      pageTitle: "ワークスペースリポジトリ",
      notFound: "ワークスペースが見つかりません。",
      loadFailed: "ワークスペースの詳細をロードできませんでした",
      workspaceListLoadFailed: "ワークスペースのロードに失敗しました",
      saveRepositoryFailed: "リポジトリの保存に失敗しました",
      updateRepositorySuccess: "リポジトリが更新されました",
      createRepositorySuccess: "リポジトリが作成されました",
      createRepositoriesSuccess: "{{count}} リポジトリが作成されました",
      deleteRepositoryFailed: "リポジトリの削除に失敗しました",
      deleteRepositorySuccess: "リポジトリが削除されました",
      saveAuthFailed: "認証の保存に失敗しました",
      saveAuthSuccess: "認証が更新されました",
      copyPublicKeyUnavailable: "このワークスペースにコピーできる SSH 公開キーがありません",
      copyPublicKeySuccess: "SSH公開キーがコピーされました",
      copyPublicKeyFailed: "SSH公開キーのコピーに失敗しました",
      generateSshKeyFailed: "SSHキーの生成に失敗しました",
      generateSshKeySuccess: "SSHキーが生成されました",
      regenerateSshKeySuccess: "SSHキーが更新されました",
      empty: "リポジトリはまだありません。まず 1 つ追加します。",
      validation: {
        repositoryUrlRequired: "リポジトリの URL を入力してください",
        repositoryUrlListRequired: "少なくとも 1 つのリポジトリ URL を入力してください",
        repositoryUrlInvalid: "各行には有効な Git SSH または HTTPS URL が含まれている必要があります",
        httpsUsernameRequired: "HTTPS ユーザー名を入力してください",
        sshUrlOnly: "このワークスペースは SSH 認証を使用するため、Git SSH URL のみが許可されます。",
        httpsUrlOnly: "このワークスペースは HTTPS 認証を使用するため、HTTPS リポジトリ URL のみが許可されます。",
        publicHttpsUrlOnly: "このワークスペースには認証が構成されていないため、パブリック HTTPS リポジトリ URL のみが許可されます。"
      },
      actions: {
        createRepository: "新しいリポジトリ",
        authSettings: "認証設定",
        edit: "編集",
        delete: "削除",
        save: "保存",
        copyPublicKey: "公開鍵をコピーする",
        copied: "コピーされました",
        generateKey: "キーの生成",
        regenerateKey: "再生成"
      },
      table: {
        url: "リポジトリURL",
        browseUrl: "URLを参照",
        actions: "アクション",
        browseUrlUnavailable: "利用不可"
      },
      repositoryDialog: {
        createTitle: "新しいリポジトリ",
        editTitle: "リポジトリの編集",
        urlListLabel: "リポジトリ URL (1 行に 1 つ)",
        urlLabel: "リポジトリURL"
      },
      authDialog: {
        title: "認証設定",
        typeLabel: "認証タイプ",
        typePlaceholder: "認証タイプを選択します",
        typeNone: "認証なし (パブリック HTTPS リポジトリ)",
        typeSsh: "SSH公開鍵",
        typeHttps: "HTTPS ユーザー名 + シークレット",
        sshPublicKeyLabel: "SSH公開鍵",
        sshPublicKeyPlaceholder: "SSH 公開キーはまだ生成されていません",
        sshPublicKeyDescription: "この公開キーをデプロイ キーまたは読み取り専用キーとしてターゲット リポジトリに追加します。",
        usernameLabel: "ユーザー名",
        usernamePlaceholder: "例: git-bot",
        usernameDescription: "一般的な値は、Git ユーザー名、サービス アカウント名、または固定プレースホルダー ユーザー名です。",
        secretLabel: "秘密",
        secretPlaceholder: "トークン、PAT、または互換性のあるパスワードを入力してください",
        secretDescriptionKeep: "現在保存されているシークレットを保持するには、空のままにします。",
        secretDescriptionRequired: "Git HTTPS アクセスに使用できるシークレットを入力します。"
      },
      authDescription: {
        ssh: "これは、デプロイ キーまたはマシン アカウントを使用してアクセスされる SSH リポジトリに使用します。",
        https: "これは、ユーザー名とトークン/PAT/パスワードを使用してアクセスされるプライベート HTTPS リポジトリに使用します。",
        none: "これはパブリック HTTPS リポジトリにのみ使用してください。追加の認証詳細は提供されません。"
      },
      repositoryInputDescription: {
        ssh: "このワークスペースは SSH 認証を使用するため、追加できるのは「git@...」または「ssh://...」リポジトリ URL のみです。",
        https: "このワークスペースは HTTPS 認証を使用するため、「https://...」リポジトリ URL のみを追加できます。",
        none: "このワークスペースには認証が構成されていないため、パブリックの「https://...」リポジトリ URL のみを追加できます。"
      },
      generateSshKeyDialog: {
        titleGenerate: "SSHキーを生成しますか?",
        titleRegenerate: "SSHキーを再生成しますか?",
        descriptionGenerate: "生成後、新しい公開キーをデプロイキーとしてターゲット Git リポジトリに追加できます。",
        descriptionRegenerate: "再生成後、古い秘密キーはすぐに機能しなくなります。このワークスペースを使用して、すべての Git リポジトリで新しい公開キーを再構成する必要があります。",
        confirmGenerate: "生成する",
        confirmRegenerate: "再生成"
      },
      deleteDialog: {
        title: "リポジトリを削除しますか?",
        description: "これにより、ワークスペースからリポジトリ設定が削除されますが、リモート リポジトリ自体には影響しません。"
      }
    },
    placeholder: {
      description: "空のページのプレースホルダー"
    }
  }
} as const;
