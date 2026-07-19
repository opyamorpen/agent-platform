export const jaJP = {
  app: {
    loading: 'アプリケーションを読み込んでいます...',
    teamLoadFailed: 'チームのロードに失敗しました',
    accessLoadFailed: '権限の読み込みに失敗しました',
    noAvailableTeam: '現在のアカウントで利用できるチームはありません'
  },
  common: {
    actions: {
      refresh: 'リフレッシュ',
      back: '戻る',
      save: '保存',
      cancel: 'キャンセル',
      confirm: '確認',
      view: '表示',
      preview: 'プレビュー',
      confirmDelete: '削除の確認',
      retry: '更新後に再試行してください'
    },
    states: {
      loading: '読み込み中...',
      saving: '保存中...',
      deleting: '削除中...'
    },
    fallback: {
      currentUser: '現在のユーザー',
      emptyValue: '-'
    }
  },
  apiErrors: {
    codes: {
      'auth.user_not_logged_in':
        'セッションの有効期限が切れました。再度サインインしてください。',
      'auth.missing_authorization_header':
        'セッションの有効期限が切れました。再度サインインしてください。',
      'auth.invalid_authorization_token':
        'サインイン トークンが無効です。再度サインインしてください。',
      'auth.organization_identifier_missing':
        'サインイン トークンに組織情報がありません。再度サインインしてください。',
      'auth.team_uuid_required':
        'チームのコンテキストが欠落しています。チームを選択してもう一度お試しください。',
      'auth.selected_team_not_accessible':
        '選択したチームにはアクセスできません。別のチームを選択して、もう一度お試しください。',
      'access.not_app_member':
        'あなたのアカウントは、現在のチームの AI ワークフローのメンバーではありません。管理者に追加を依頼してください。',
      'access.admin_only': 'このページは管理者のみが利用できます。',
      'common.internal_server_error':
        '内部サーバーエラー。後でもう一度試してください。',
      'common.route_not_found':
        '要求されたエンドポイントが見つかりませんでした。',
      'skills.invalid_payload': 'スキルリクエストのペイロードが無効です。',
      'skills.invalid_package_payload':
        'スキルパッケージが無効です。ディレクトリ構造とSKILL.mdを確認してください。',
      'skills.uuid_required': 'スキル識別子がありません。',
      'skills.version_invalid': 'スキルのバージョンが無効です。',
      'skills.not_found': '要求されたスキルが見つかりませんでした。',
      'skills.conflict': '同名のスキルが既に存在します。',
      'skills.in_use':
        'このスキルは依然としてエージェントによって参照されているため、削除できません。',
      'agent_clients.invalid_connect_payload':
        'エージェント クライアント接続要求ペイロードが無効です。',
      'agent_clients.invalid_connect_poll_payload':
        'エージェント クライアントのポーリング リクエスト ペイロードが無効です。',
      'agent_clients.invalid_connection_request':
        'エージェント クライアント接続リクエストは無効になりました。新しい接続リクエストを開始します。',
      'agent_clients.uuid_required':
        'エージェントのクライアント識別子がありません。',
      'agent_clients.not_found':
        '要求されたエージェント クライアントが見つかりませんでした。',
      'executions.dispatched_issue_uuid_required':
        '課題実行レコード識別子がありません。',
      'executions.dispatched_issue_not_found':
        '要求された課題実行レコードが見つかりませんでした。',
      'executions.issue_execution_history_uuid_required':
        '実行履歴識別子がありません。',
      'executions.issue_execution_history_not_found':
        '要求された実行履歴が見つかりませんでした。',
      'executions.issue_agent_execution_history_uuid_required':
        'エージェント実行履歴識別子がありません。',
      'executions.issue_agent_execution_history_not_found':
        '要求されたエージェントの実行履歴が見つかりませんでした。',
      'executions.issue_agent_execution_retry_not_allowed':
        '現在のエージェント実行レコードを再試行することはできません。更新して再試行してください。',
      'workflows.uuid_required': 'ワークフロー識別子がありません。',
      'workflows.invalid_payload':
        'ワークフロー リクエストのペイロードが無効です。',
      'workflows.not_found': '要求されたワークフローが見つかりませんでした。',
      'workflows.node_uuid_required': 'ワークフロー ノード識別子がありません。',
      'workflows.invalid_node_payload':
        'ワークフロー ノードのペイロードが無効です。',
      'workflows.node_not_found':
        '要求されたワークフロー ノードが見つかりませんでした。',
      'workflows.node_executor_invalid':
        'ワークフロー ノード上のエージェント バインドが無効です。',
      'workflows.deletion_blocked':
        'このワークフローにはまだ実行ノードが含まれています。ワークフローを削除する前に、これらのノードを削除してください。',
      'agents.invalid_payload': 'エージェント要求ペイロードが無効です。',
      'agents.invalid_prompt_preview_payload':
        'プロンプト プレビュー ペイロードが無効です。',
      'agents.invalid_prompt_recommendation_payload':
        'プロンプト推奨リクエストが無効です。',
      'ai_model_config.not_configured':
        '管理者が AI モデルを設定していません。',
      'ai_model_config.unsafe_base_url':
        'モデル URL が公開 HTTPS セキュリティポリシーを満たしていません。',
      'skill_generation.revision_conflict':
        'Skill ドラフトが変更されました。再読み込みして再試行してください。',
      'skill_generation.script_review_required':
        '生成されたスクリプトを確認してください。',
      'agents.invalid_draft_payload':
        'エージェントのドラフト ペイロードが無効です。',
      'agents.invalid_publish_payload':
        'エージェントのパブリッシュ ペイロードが無効です。',
      'agents.workspace_binding_not_found':
        'バインドされたエージェント ワークスペースが見つかりませんでした。',
      'agents.skill_binding_not_found':
        'バインドされたエージェント スキルが見つかりませんでした。',
      'agents.knowledge_binding_not_found':
        'バインドされたナレッジソースが見つかりませんでした。',
      'agents.wiki_write_target_required':
        '関連 Wiki ページの出力には書き込み先が必要です。',
      'agents.conflict':
        'エージェントのデータが競合しています。更新して再試行してください。',
      'agents.uuid_required': 'エージェント識別子がありません。',
      'agents.not_found': '要求されたエージェントが見つかりませんでした。',
      'agents.draft_not_found':
        'このエージェントに対して公開できるドラフト構成はありません。',
      'agents.in_use':
        'このエージェントは依然としてワークフローによって参照されているため、削除できません。',
      'members.invalid_payload': 'メンバーリクエストのペイロードが無効です。',
      'members.conflict': 'このメンバーはすでに存在します。',
      'members.user_uuid_required': 'メンバーのユーザー識別子がありません。',
      'members.not_found': '要求されたメンバーが見つかりませんでした。',
      'ones.config_error':
        'ONES 統合構成が無効です。管理者に確認を依頼してください。',
      'ones.request_error':
        'ONES サービスのリクエストに失敗しました。後でもう一度試してください。',
      'ones.response_error':
        'ONES サービスは処理できない応答を返しました。後でもう一度試してください。',
      'ones.invalid_user_search_query': 'ONES ユーザーの検索クエリが無効です。',
      'agent_workspaces.invalid_payload':
        'ワークスペースリクエストのペイロードが無効です。',
      'agent_workspaces.uuid_required': 'ワークスペース識別子がありません。',
      'agent_workspaces.not_found':
        '要求されたワークスペースが見つかりませんでした。',
      'agent_workspaces.in_use':
        'このワークスペースは依然としてエージェントによって参照されているため、削除できません。',
      'agent_workspaces.auth_conflict':
        '現在のワークスペース認証構成は、この操作と互換性がありません。',
      'agent_workspaces.repository_uuid_required':
        'リポジトリ識別子がありません。',
      'agent_workspaces.invalid_repository_payload':
        'リポジトリ リクエストのペイロードが無効です。',
      'agent_workspaces.repository_not_found':
        '要求されたリポジトリが見つかりませんでした。',
      'agent_workspaces.invalid_auth_payload':
        'ワークスペース認証ペイロードが無効です。',
      'agent_workspaces.invalid_credential_payload':
        'ワークスペース資格情報ペイロードが無効です。',
      'agent_workspaces.credential_env_name_required':
        '資格情報の環境変数名がありません。',
      'agent_workspaces.credential_not_found':
        '要求されたワークスペース資格情報が見つかりませんでした。',
      'knowledge_sources.invalid_payload':
        'ナレッジソースのリクエストが無効です。',
      'knowledge_sources.not_found':
        'ナレッジソースまたは Wiki スペースが見つかりません。',
      'knowledge_sources.conflict':
        'ナレッジソースが既に存在するか、Agent から参照されています。',
      'asset_optimization.invalid_payload':
        'アセット最適化リクエストが無効です。',
      'asset_optimization.invalid_apply_payload':
        '候補適用リクエストが無効です。',
      'asset_optimization.invalid_dismiss_payload':
        '候補除外リクエストが無効です。',
      'asset_optimization.not_found':
        'アセット最適化レコードが見つかりません。',
      'asset_optimization.conflict':
        'アセットまたは候補が変更されました。更新して再試行してください。',
      'asset_optimization.no_samples':
        '現在の Agent バージョンには履歴サンプルがありません。',
      'asset_optimization.script_review_required':
        '候補スクリプトを確認してください。',
      'asset_optimization.invalid_skill_files':
        '候補 Skill ファイルが安全性検証に失敗しました。'
    }
  },
  language: {
    label: '言語',
    options: {
      'zh-CN': '簡体字中国語',
      'en-US': '英語',
      'ja-JP': '日本語'
    }
  },
  navigation: {
    groups: {
      aiWorkflow: 'AI ワークフロー',
      agentDesign: 'エージェントの設計',
      adminSettings: '管理者設定'
    },
    items: {
      workflowExecution: 'ワークフローの実行',
      workflowDesign: 'ワークフローの設計',
      agentConfig: 'エージェント構成',
      agentSkills: 'エージェントのスキル',
      agentKnowledge: 'エージェントナレッジ',
      agentWorkspaces: 'エージェントワークスペース',
      agentClients: 'エージェントクライアント',
      loopRuntimeConfig: 'ループエンジニアリング',
      assetOptimizations: 'アセット最適化',
      workspaceVerificationProfiles: 'ワークスペース検証',
      aiModelConfig: 'AI モデル',
      members: 'メンバー'
    }
  },
  header: {
    titles: {
      dashboard: 'ダッシュボード',
      workflowExecution: 'ワークフローの実行',
      workflowDesign: 'ワークフローの設計',
      agentConfig: 'エージェント構成',
      agentClients: 'エージェントクライアント',
      agentWorkspaces: 'エージェントワークスペース',
      agentSkills: 'エージェントのスキル',
      agentKnowledge: 'エージェントナレッジ',
      loopRuntimeConfig: 'ループエンジニアリング',
      aiModelConfig: 'AI モデル設定',
      assetOptimizations: 'アセット最適化'
    },
    descriptions: {
      workflowExecution:
        'ワークフローによってトリガーされた実行レコードを表示し、各実行の最新ステータスを追跡します。',
      workflowDesign:
        'ONES ワークフローをエージェントに接続して、エージェントがビジネス フローの実行に参加できるようにします。',
      agentConfig:
        'プロンプト、実行 ID、ワークスペース、バインドされたスキルなどの基本エージェント設定を定義します。',
      agentWorkspaces:
        'タスクを実行するために必要なワークスペース、リポジトリ、およびランタイム環境をエージェントに提供します。',
      agentSkills:
        'エージェントに再利用可能な機能、知識、および実行ルールを提供します。',
      agentKnowledge:
        'Agent で再利用する ONES Wiki スペースのナレッジソースを管理します。'
    }
  },
  permissionDenied: {
    title: {
      adminOnly: '管理者のみ',
      notAppMember: '現在のチームにいない',
      missingOrgAdmin: 'AI ワークフローにアクセスできない'
    },
    description: {
      adminOnly:
        'このページは管理者のみがアクセスできるため、アクセスがブロックされています。',
      notAppMember:
        'あなたのアカウントはまだこのチームの AI ワークフローのメンバーではないため、アクセスはブロックされています。',
      missingOrgAdmin:
        'お使いのアカウントには、このアプリを使用するために必要な組織レベルの権限がないため、アクセスがブロックされました。'
    },
    hint: {
      adminOnly:
        'エージェントのクライアントまたはメンバーを管理する必要がある場合は、組織管理者に問い合わせてください。',
      notAppMember:
        'このチームの AI ワークフロー メンバーにあなたを追加するように管理者に依頼してから、更新して再試行してください。',
      missingOrgAdmin:
        '管理者にアカウントにアプリケーション管理者権限を付与するよう依頼し、ページをリロードしてください。'
    },
    requiredPermission: '必要な許可'
  },
  teamSwitcher: {
    loading: 'チームを読み込んでいます...',
    error: 'チームのロードに失敗しました',
    empty: 'チームがありません',
    label: 'チームを選択'
  },
  searchSelect: {
    placeholder: '検索または選択',
    empty: '一致するものが見つかりませんでした',
    overflowFiltered:
      '結果が多すぎます。最初の {{count}} アイテムを表示しています。入力を続けて絞り込みます。',
    overflowUnfiltered:
      '最初の {{count}} アイテムを表示しています。さらに多くの結果を検索するには、キーワードを入力します。'
  },
  pages: {
    agentClients: {
      loadFailed: 'エージェントクライアントのロードに失敗しました',
      approveFailed: 'エージェントクライアントの承認に失敗しました',
      approveSuccess: 'エージェントクライアント「{{name}}」が承認されました',
      revokeFailed: 'エージェントクライアントの取り消しに失敗しました',
      revokeSuccess: 'エージェントクライアント「{{name}}」が取り消されました',
      empty: 'エージェントクライアントデータなし',
      table: {
        name: '名前',
        hostname: 'ホスト',
        uuid: 'UUID',
        version: 'バージョン',
        connectionStatus: '接続状態',
        runtimeStatus: '稼働状態',
        lastExchangeAt: '最終通信',
        actions: 'アクション'
      },
      actions: {
        approve: '承認する',
        revoke: '取り消す'
      },
      connectionStatus: {
        pending_approval: '承認待ち',
        approved: '承認済み',
        active: 'アクティブ',
        revoked: '取り消し済み'
      },
      runtimeStatus: {
        online: 'オンライン',
        offline: 'オフライン'
      }
    },
    issues: {
      loadFailed: '課題の読み込みに失敗しました',
      deleteFailed: '実行記録の削除に失敗しました',
      deleteSuccess: '現在の課題の実行記録を削除しました',
      empty: '課題データがありません',
      table: {
        displayId: 'ID',
        title: 'タイトル',
        project: 'プロジェクト',
        issueType: 'タイプ',
        latestExecutionStatus: '最新の実行状況',
        lastDispatchedAt: '最終実行時刻',
        actions: 'アクション'
      },
      actions: {
        history: '実行履歴',
        delete: '削除'
      },
      status: {
        created: '作成されました',
        executing: '実行中',
        success: '成功',
        failure: '失敗',
        blocked: 'ブロックされました'
      },
      deleteDialog: {
        title: '実行記録を削除しますか?',
        descriptionWithIssue:
          'これにより、このシステム内の課題「{{name}}」の実行レコード、ログ、入出力スナップショットが削除されますが、ONES 内の課題自体は削除されません。',
        descriptionFallback:
          'このシステム内の現在の課題の実行記録を削除します。'
      }
    },
    issueDetail: {
      missingUuid: '課題 UUID がありません',
      pageTitle: '課題',
      loadFailed: '課題の詳細を読み込めませんでした',
      historiesLoadFailed: '実行履歴の読み込みに失敗しました',
      logsLoadFailed: '実行ログのロードに失敗しました',
      retryFailed: '実行の再試行に失敗しました',
      retrySuccess:
        'エージェント「{{name}}」が保留中の実行にリセットされました',
      notFound: '課題が見つかりません',
      empty: '実行履歴がありません',
      logsSectionTitle: 'ログ',
      logsSectionEmpty: 'ログ内容がありません',
      actions: {
        viewLogs: 'ログ',
        viewInput: '入力を表示',
        viewOutput: '出力を表示する',
        retry: 'リトライ',
        refreshLogs: 'ログを更新する',
        downloadLogs: 'ログをダウンロードする',
        viewVerification: '検証結果',
        downloadPatch: 'Patch をダウンロード'
      },
      states: {
        logsRefreshing: '更新中...',
        logsLoading: 'ログを読み込んでいます...',
        retrying: '再試行中...'
      },
      table: {
        agent: 'エージェント',
        iteration: '実行ラウンド',
        attempt: 'システム試行',
        attemptNumber: '第 {{count}} 回',
        initialIteration: '初回実行',
        revisionIteration: '第 {{count}} 回の再作業',
        executeClient: '実行クライアント',
        status: '状態',
        inputTokens: '入力トークン',
        outputTokens: '出力トークン',
        startedAt: '開始時刻',
        finishedAt: '終了時刻',
        actions: 'アクション'
      },
      status: {
        created: '作成されました',
        queued: 'キューに入れられました',
        running: '実行中',
        success: '成功',
        failure: '失敗',
        blocked: 'ブロックされました'
      },
      logsDialog: {
        titleWithAgent: '{{name}} ログ',
        titleFallback: '実行ログ'
      },
      verificationDialog: {
        title: 'コード検証結果',
        step: 'ステップ',
        status: '結果',
        duration: '所要時間',
        output: '出力'
      },
      rawDialog: {
        titleInputWithAgent: '{{name}}入力',
        titleOutputWithAgent: '{{name}} 出力',
        titleFallback: '生のコンテンツ',
        sectionTitleInput: '入力',
        sectionTitleOutput: '出力',
        emptyInput: '生の入力コンテンツがありません',
        emptyOutput: '生の出力コンテンツはありません'
      },
      retryDialog: {
        title: '実行を再試行しますか?',
        descriptionWithAgent:
          'エージェント「{{name}}」の新しい実行試行を作成し、現在のレコードを保持します。',
        descriptionFallback:
          '新しい実行試行を作成し、現在のレコードを保持します。'
      }
    },
    workflows: {
      loadFailed: 'ワークフローの読み込みに失敗しました',
      saveFailed: 'ワークフローの保存に失敗しました',
      updateNameSuccess: 'ワークフロー名が更新されました',
      createSuccess: 'ワークフローが作成されました',
      deleteFailed: 'ワークフローの削除に失敗しました',
      deleteSuccess: 'ワークフロー「{{name}}」が削除されました',
      toggleFailed: 'ワークフローステータスの更新に失敗しました',
      enabledSuccess: 'ワークフローの有効化',
      disabledSuccess: 'ワークフローが無効になっています',
      validation: {
        nameRequired: 'ワークフロー名を入力してください'
      },
      empty: 'ワークフローデータがありません',
      actions: {
        create: '新しいワークフロー',
        edit: '名前を変更',
        configureNodes: 'ノード設定',
        delete: '削除',
        save: '保存',
        createSubmit: '作成する'
      },
      status: {
        enabled: '有効',
        disabled: '無効',
        enableAria: 'ワークフローを有効にする {{name}}',
        disableAria: 'ワークフローを無効にする {{name}}'
      },
      table: {
        index: '番号',
        name: 'ワークフロー名',
        status: '状態',
        actions: 'アクション'
      },
      dialog: {
        editTitle: 'ワークフロー名を変更',
        createTitle: '新しいワークフロー',
        editDescription:
          '既存の実行ノード設定に影響を与えずに、リストに表示される表示名を更新します。',
        createDescription:
          'まずワークフローを作成し、次にそのトリガー条件と実行ノードを構成します。',
        nameLabel: 'ワークフロー名',
        namePlaceholder: 'ワークフロー名を入力してください',
        saving: '保存中...',
        creating: '作成...'
      },
      deleteDialog: {
        title: 'ワークフローを削除しますか?',
        descriptionWithName:
          'ワークフロー「{{name}}」は削除後に復元できず、関連する実行ノードも削除されます。',
        descriptionFallback: 'ワークフローを削除した後は復元できません。'
      }
    },
    agents: {
      loadFailed: 'エージェントのロードに失敗しました',
      createFailed: 'エージェントの作成に失敗しました',
      duplicateFailed: 'エージェントの複製に失敗しました',
      duplicateName: '{{name}} コピー',
      duplicateSuccess: 'エージェント「{{name}}」が複製されました',
      deleteFailed: 'エージェントの削除に失敗しました',
      deleteSuccess: 'エージェント「{{name}}」が削除されました',
      empty: 'エージェントデータなし',
      actions: {
        create: '新しいエージェント',
        configure: '設定する',
        duplicate: '複製',
        delete: '削除'
      },
      table: {
        index: '番号',
        name: 'エージェント名',
        workspace: 'ワークスペース',
        executor: '実行者',
        skills: 'スキル',
        actions: 'アクション'
      },
      deleteDialog: {
        title: 'エージェントを削除しますか?',
        descriptionWithName:
          'エージェント「{{name}}」は削除後に復元できません。ワークフローによってまだ参照されている場合、削除はブロックされます。',
        descriptionFallback: 'エージェントを削除した後は復元できません。'
      }
    },
    agentDetail: {
      missingUuid: 'エージェントの UUID がありません',
      draftLoadFailed: 'エージェント構成のロードに失敗しました',
      promptPreviewLoadFailed: 'プロンプト プレビューの読み込みに失敗しました',
      onesFieldsLoadFailed: 'ONES フィールドのロードに失敗しました',
      resourcesLoadFailed: 'エージェントバインディングのロードに失敗しました',
      workspacesLoadFailed: 'ワークスペースのロードに失敗しました',
      agentClientsLoadFailed: 'Agent Client の読み込みに失敗しました',
      skillsLoadFailed: 'スキルのロードに失敗しました',
      knowledgeSourcesLoadFailed: 'ナレッジソースの読み込みに失敗しました',
      verificationProfilesLoadFailed: 'コード検証設定の読み込みに失敗しました',
      wikiSpacesLoadFailed: 'Wiki ページグループの読み込みに失敗しました',
      executorSearchFailed: '実行者の検索に失敗しました',
      basicConfigSaveFailed: 'エージェントの基本設定を保存できませんでした',
      draftSaveFailed: '下書きの保存に失敗しました',
      publishFailed: 'エージェント構成の公開に失敗しました',
      publishSuccess: 'エージェント構成が公開されました',
      recommendation: {
        action: 'AI で生成',
        generating: '推奨プロンプトを生成中...',
        title: '推奨プロンプト',
        description:
          'エージェントの目標、入力、出力、選択した Skill から生成します。確認後にのみ適用されます。',
        apply: '推奨を適用',
        applied: '推奨プロンプトを適用しました',
        failed: '推奨プロンプトの生成に失敗しました',
        contextChanged:
          'エージェント構成が変更されました。再生成してください。',
        notConfigured: '管理者が AI モデルを設定していません'
      },
      validation: {
        nameRequired: 'エージェント名を入力してください',
        wikiWriteTargetRequired:
          '関連 Wiki ページの出力先ページグループを選択してください',
        acceptanceCriterionRequired: '受入基準の名前と説明は必須です',
        executionTargetRequired: '有効な Agent 実行方式を選択してください',
        organizationModelWorkspace:
          '組織既定 AI モデルではコードワークスペースを使用できません'
      },
      duplicateInputField:
        '最上位フィールド「{{name}}」には入力バインディングがすでに存在します。',
      duplicateOutputField:
        '最上位フィールド「{{name}}」には出力バインディングがすでに存在します。',
      onlyOneWikiOutput:
        '各 Agent に設定できる関連 Wiki ページ出力フィールドは 1 つまでです',
      steps: {
        basic: '基本設定',
        inputs: '入力設定',
        outputs: '出力設定',
        acceptance: '受入ポリシー',
        prompt: 'プロンプト'
      },
      actions: {
        previewPrompt: 'プロンプトプレビュー',
        previousStep: '前の',
        nextStep: '次',
        edit: '編集',
        publish: '公開',
        confirm: '確認する'
      },
      basic: {
        nameLabel: '名前',
        namePlaceholder: 'エージェント名を入力してください',
        descriptionLabel: 'ビジネス目標',
        descriptionPlaceholder:
          'エージェントの責任、目標、主要ルール、完了基準を説明します',
        executionTargetLabel: '実行方式',
        executionTargetPlaceholder:
          '組織モデルまたは特定の Agent Client を選択',
        executionTargetEmpty: '利用可能な Agent Client がありません',
        executionTargetOrganizationModel: '組織既定 AI モデル',
        executionTargetLegacyAnyClient:
          '任意の Agent Client（旧バージョン互換）',
        executionTargetHelpLabel: '実行方式',
        executionTargetHelpContent:
          '組織モデルは Server 上で実行され、コードリポジトリの読み取りやコマンド実行はできません。Client を指定すると、その Client だけがタスクを取得できます。',
        executionTargetModelNotConfigured:
          '管理者が組織既定 AI モデルを設定していないため、この構成は公開できません。',
        executionTargetLegacyWarning:
          '旧バージョン互換モードです。任意のオンライン Client がタスクを取得できます。組織モデルまたは特定の Client を選択してください。',
        clientRuntimeStatus: {
          online: 'オンライン',
          offline: 'オフライン'
        },
        executorLabel: '実行者',
        executorPlaceholder: 'ONESユーザーを検索',
        executorSearchLoading: '検索中...',
        executorEmpty: '一致する ONES ユーザーがいません',
        executorSearchHint: '名前、メールアドレス、スタッフIDで検索',
        executorHelpLabel: '実行者',
        executorHelpContent:
          '空のままにすると、実行結果は特定の ONES ユーザー ID にバインドされません。',
        workspaceLabel: 'ワークスペース',
        workspacePlaceholderLoading: 'ワークスペースを読み込んでいます...',
        workspacePlaceholder: 'オプション、ワークスペースが選択されていません',
        workspaceEmpty:
          '利用可能なワークスペースがありません。これは空のままにすることができます。',
        workspaceHelpLabel: 'ワークスペース',
        workspaceHelpContent:
          'ローカル コード リポジトリに依存しないエージェントの場合、ワークスペースは空のままにすることができます。',
        skillsLabel: 'スキル',
        skillsPlaceholder: 'スキルの検索または選択',
        skillsEmpty: 'バインド可能なスキルはありません',
        knowledgeLabel: 'ナレッジ',
        knowledgePlaceholder: '最大 5 件のナレッジソースを検索または選択',
        knowledgeEmpty: 'バインド可能なナレッジソースはありません',
        knowledgeHelp:
          'バインド変更は再公開後に有効になります。Wiki 内容の更新には再公開は不要です。'
      },
      fields: {
        pickerPlaceholder: 'フィールドを検索または選択します',
        pickerEmpty: '使用可能なフィールドがありません',
        addField: 'フィールドの追加',
        empty: 'まだフィールドがありません。まず上のフィールドを選択します。',
        emptySubFields:
          'まだ内部フィールドはありません。まずフィールドを追加します。',
        emptyOutputSubFields:
          'まだ内部フィールドはありません。これらを追加すると、エージェントはこれらの説明に基づいて内部の課題オブジェクト フィールドを生成します。',
        table: {
          name: 'フィールド名',
          description: 'フィールドの説明',
          actions: 'アクション'
        },
        preview: {
          noSubFieldDescriptions:
            '内部フィールドの説明がまだ設定されていません',
          noDescription: '説明がありません'
        },
        internalFieldSummaryTitle: '{{fieldName}} の内部フィールドの説明',
        inputDescriptionPlaceholder:
          'この入力フィールドがエージェントによってどのように使用されるかを説明します',
        inputSubFieldDescriptionPlaceholder:
          'この内部フィールドがエージェントによってどのように使用されるかを説明します',
        outputDescriptionPlaceholderObject:
          'この出力フィールドが全体的に何を行うべきかを説明します。たとえば、課題オブジェクトの作成、更新、作成/更新などです。',
        outputDescriptionPlaceholderSimple:
          'この出力フィールドがエージェントによってどのように使用されるかを説明します',
        wikiWriteTargetLabel: 'Wiki 書き込み先ページグループ',
        wikiWriteTargetPlaceholder: '出力先の Wiki ページグループを選択',
        wikiWriteTargetEmpty: '書き込み可能な Wiki ページグループがありません',
        wikiWriteTargetHelp:
          'ナレッジソースは読み取り専用です。Wiki の作成と追記は、ここで選択したページグループに制限されます。',
        outputSubFieldDescriptionPlaceholder:
          'この内部フィールドを書き戻す方法を説明します。',
        editInternalFieldSummaryTitle:
          '{{fieldName}} の内部フィールドの説明を編集',
        outputSubFieldDialogDescription:
          '最上位フィールドの説明は外側のテーブルで編集します。このダイアログでは、Issue オブジェクトの内部フィールドとその説明のみを管理します。',
        inputSubFieldUnsupported:
          'このフィールドは Issue 参照フィールドではないため、内部フィールドを設定できません。',
        outputSubFieldUnsupported:
          'このフィールドは Issue 参照フィールドではないため、内部フィールドは不要です。',
        moveUpAria: 'フィールド{{name}}を上に移動',
        moveDownAria: 'フィールド {{name}} を下に移動します'
      },
      acceptance: {
        title: '受入ポリシー',
        description: '自動修正ループは、ここで定義した各受入基準を確認します。',
        addCriterion: '基準を追加',
        knowledgeRequirement: 'ナレッジ根拠要件',
        knowledgeOptional: 'ナレッジ根拠は任意',
        knowledgeRequired: 'ナレッジ根拠が必須',
        verificationProfiles: 'コード検証設定',
        verificationProfilesPlaceholder: 'このワークスペースの検証設定を選択',
        verificationProfilesEmpty: 'このワークスペースに検証設定はありません',
        verificationProfilesHelp:
          'Agent 実行後に選択した検証ステップを順番に実行し、すべて合格してから業務受入へ進みます。',
        verificationProfilesWorkspaceRequired:
          '先に基本情報でワークスペースを選択してください。',
        empty:
          '業務受入基準は未設定です。コード検証設定のみでも自動修正を有効にできます。',
        namePlaceholder: '受入基準 {{index}}',
        descriptionPlaceholder: '検証可能な合格条件と品質要件を説明してください'
      },
      prompt: {
        placeholder:
          '例: あなたは要件分析が得意なアシスタントです。入力フィールドに基づいてコンテンツを生成します...'
      },
      preview: {
        title: 'プロンプトプレビュー',
        description:
          'このビューには、入力フィールド、出力フィールド、およびプロンプトから組み立てられた最終的なコンテンツが表示されます。',
        panelTitle: 'プロンプトプレビュー',
        loading: 'プレビューを生成中...'
      },
      publishDialog: {
        title: '設定の公開',
        description:
          '公開すると、現在の設定が新しいバージョンとして保存され、すぐに有効になります。続行しますか？',
        publishing: '公開中...',
        confirm: '公開の確認'
      }
    },
    verificationProfiles: {
      title: 'ワークスペース検証',
      description:
        'コードワークスペースのテスト、型チェック、ビルドを設定します。実行ファイルと引数は Shell を使用せず実行されます。',
      loadFailed: '検証設定の読み込みに失敗しました',
      workspacesLoadFailed: 'ワークスペースの読み込みに失敗しました',
      saveFailed: '検証設定の保存に失敗しました',
      saveSuccess: '検証設定を保存しました',
      deleteFailed: '検証設定の削除に失敗しました',
      deleteSuccess: '検証設定を削除しました',
      deleteConfirm: '検証設定「{{name}}」を削除しますか？',
      validationRequired:
        '名前、ワークスペース、少なくとも 1 つの検証ステップを入力してください。',
      validationStepRequired:
        '各ステップに名前、リポジトリ、実行ファイルが必要です。',
      create: '検証設定を作成',
      createTitle: 'ワークスペース検証設定を作成',
      editTitle: 'ワークスペース検証設定を編集',
      empty: 'ワークスペース検証設定はありません。',
      name: '名前',
      workspace: 'ワークスペース',
      steps: '検証ステップ',
      actions: '操作',
      addStep: 'ステップを追加',
      stepName: 'ステップ名',
      repository: 'リポジトリ',
      workingDirectory: 'リポジトリ内作業ディレクトリ',
      executable: '実行ファイル',
      args: '引数（1 行に 1 つ）',
      timeout: 'タイムアウト（秒）'
    },
    members: {
      loadFailed: 'メンバーのロードに失敗しました',
      searchFailed: 'ONES ユーザーの検索に失敗しました',
      addFailed: 'メンバーの追加に失敗しました',
      addSuccess: 'メンバー「{{name}}」を追加しました',
      removeFailed: 'メンバーの削除に失敗しました',
      removeSuccess: 'メンバー「{{name}}」が削除されました',
      selectUserRequired: 'ONES ユーザーを選択してください',
      empty: 'メンバーがいません',
      actions: {
        add: 'メンバーを追加',
        remove: '取り除く',
        confirmAdd: '追加の確認',
        adding: '追加中...',
        confirmRemove: '削除の確認',
        removing: '削除中...'
      },
      table: {
        name: '名前',
        email: '電子メール',
        staffId: 'スタッフID',
        userUuid: 'ユーザーUUID',
        createdAt: 'に追加されました',
        actions: 'アクション'
      },
      dialog: {
        title: 'メンバーを追加',
        description:
          'ONES ユーザー アカウントを選択し、現在のチームの AI Workflow メンバー リストに追加します。',
        userLabel: 'ONESユーザー',
        searchPlaceholderLoading: 'ONES ユーザーを検索しています...',
        searchPlaceholder: '名前、メールアドレス、スタッフIDで検索',
        searchEmptyLoading: '検索中...',
        searchEmpty: '一致する ONES ユーザーがいません',
        selectedName: '名前: {{value}}',
        selectedEmail: 'メールアドレス: {{value}}',
        selectedStaffId: 'スタッフID：{{value}}'
      },
      deleteDialog: {
        title: 'メンバーの削除',
        description:
          'メンバー「{{name}}」を削除しますか?削除後、このアカウントは現在のチームの AI ワークフローにアクセスできなくなります。'
      }
    },
    agentWorkspaces: {
      loadFailed: 'ワークスペースのロードに失敗しました',
      saveFailed: 'ワークスペースの保存に失敗しました',
      updateSuccess: 'ワークスペースが更新されました',
      createSuccess: 'ワークスペースが作成されました',
      deleteFailed: 'ワークスペースの削除に失敗しました',
      deleteSuccess: 'ワークスペース「{{name}}」が削除されました',
      validation: {
        nameRequired: 'ワークスペース名を入力してください'
      },
      empty: 'まだワークスペースがありません。まず 1 つ作成します。',
      actions: {
        create: '新しいワークスペース',
        edit: '編集',
        repositories: 'リポジトリ',
        credentials: '認証情報',
        delete: '削除',
        save: '保存'
      },
      table: {
        workspace: 'ワークスペース',
        repositories: 'リポジトリ',
        credentials: '認証情報',
        actions: 'アクション',
        repositoryCount: '{{count}}',
        credentialCount: '{{count}}'
      },
      dialog: {
        createTitle: '新しいワークスペース',
        editTitle: 'ワークスペースの編集',
        nameLabel: '名前',
        namePlaceholder: '例: デフォルトのワークスペース'
      },
      deleteDialog: {
        title: 'ワークスペースを削除しますか?',
        description:
          'ワークスペースを削除すると、その下のリポジトリ設定もすべて削除されます。これを元に戻すことはできません。'
      }
    },
    agentWorkspaceCredentials: {
      missingUuid: 'ワークスペース uuid がありません',
      pageTitle: 'ワークスペースの認証情報',
      notFound: 'ワークスペースが見つかりません',
      loadFailed: 'ワークスペース資格情報のロードに失敗しました',
      saveFailed: '認証情報の保存に失敗しました',
      saveSuccess: '認証情報が保存されました',
      deleteFailed: '認証情報の削除に失敗しました',
      deleteSuccess: '資格情報が削除されました',
      empty:
        'まだ資格情報がありません。追加された資格情報は、タスクの実行中に環境変数として挿入されます。',
      actions: {
        create: '新しい資格情報',
        delete: '削除',
        save: '保存'
      },
      table: {
        envName: '変数名',
        description: '説明',
        updatedAt: '更新日時',
        actions: 'アクション'
      },
      dialog: {
        title: '新しい資格情報',
        envNameLabel: '環境変数名',
        envNamePlaceholder: 'OPENAI_API_KEY',
        envNameDescription:
          '大文字で始まり、A ～ Z、0 ～ 9、_ のみを含める必要があります。同じ名前の既存の資格情報は上書きされます。',
        valueLabel: '資格情報の値',
        valuePlaceholder: 'sk-...',
        descriptionLabel: '説明',
        descriptionPlaceholder: 'OpenAI APIを呼び出すために使用されます'
      },
      validation: {
        envNameRequired: '環境変数名を入力してください',
        envNameInvalid:
          '名前は大文字で始まり、A ～ Z、0 ～ 9、_ のみを含む必要があります。',
        valueRequired: '資格情報の値を入力してください',
        descriptionTooLong: '説明は最大 256 文字にする必要があります'
      },
      deleteDialog: {
        title: '認証情報を削除しますか?',
        description:
          '削除後、この環境変数はタスクの実行中に挿入されなくなります。'
      }
    },
    knowledgeSources: {
      loadFailed: 'ナレッジソースの読み込みに失敗しました',
      spacesLoadFailed: 'Wiki スペースの読み込みに失敗しました',
      saveFailed: 'ナレッジソースの保存に失敗しました',
      saveSuccess: 'ナレッジソースを保存しました',
      deleteFailed: 'ナレッジソースの削除に失敗しました',
      deleteSuccess: 'ナレッジソースを削除しました',
      empty: 'ナレッジソースはありません',
      actions: { create: 'ナレッジソースを作成', edit: '編集', delete: '削除' },
      table: {
        name: '名前',
        space: 'Wiki スペース',
        status: '状態',
        lastSuccess: '最終成功検索',
        lastError: '最新エラー',
        actions: '操作'
      },
      status: { active: '有効', disabled: '無効', error: 'エラー' },
      form: {
        createTitle: 'ナレッジソースを作成',
        editTitle: 'ナレッジソースを編集',
        description:
          'ナレッジソースは ONES Wiki スペース全体を参照し、ページ本文は保存しません。',
        name: '名前',
        space: 'Wiki スペース',
        spacePlaceholder: 'Wiki スペースを検索または選択',
        detail: '説明',
        status: '状態',
        required: '名前を入力し Wiki スペースを選択してください'
      },
      deleteDialog: {
        title: 'ナレッジソースを削除しますか?',
        description:
          '「{{name}}」を削除しますか。Agent の下書きまたは公開済みバージョンから参照されている場合は削除できません。'
      }
    },
    skills: {
      loadFailed: 'スキルのロードに失敗しました',
      downloadFailed: 'スキルのダウンロードに失敗しました',
      uploadFailed: 'スキルのアップロードに失敗しました',
      uploadSuccess: 'スキルをアップロードしました',
      uploadVersionFailed: '新しいスキルバージョンのアップロードに失敗しました',
      uploadVersionSuccess: '新しいスキルバージョンがアップロードされました',
      deleteFailed: 'スキルの削除に失敗しました',
      deleteSuccess: 'スキル「{{name}}」を削除しました',
      empty: 'スキルデータなし',
      ai: {
        create: 'AI で作成',
        creating: '作成中...',
        createFailed: 'Skill ドラフトの作成に失敗しました',
        notConfigured: '管理者が AI モデルを設定していません',
        drafts: '未完了の AI ドラフト'
      },
      validation: {
        filesRequired: 'ディレクトリを選択してください'
      },
      actions: {
        upload: 'スキルのアップロード',
        download: 'ダウンロード',
        uploadVersion: '新しいバージョンをアップロードする',
        delete: '削除',
        startUpload: 'アップロードを開始する',
        confirmUpload: 'アップロード'
      },
      table: {
        name: '名前',
        description: '説明',
        currentVersion: '現在のバージョン',
        updatedAt: '更新日時',
        actions: 'アクション'
      },
      dialog: {
        createTitle: 'スキルのアップロード',
        createDescription:
          'アップロードするスキル ディレクトリを選択します。ディレクトリの内容はスキル仕様に従う必要があります。',
        uploadTitle: '新しいスキルバージョンをアップロードする',
        uploadDescriptionWithName:
          '{{name}} の新しいディレクトリ パッケージをアップロードします。システムはSKILL.mdからメタデータを再抽出します。',
        uploadDescriptionFallback:
          '新しいディレクトリ パッケージをアップロードします。システムはSKILL.mdからメタデータを再抽出します。',
        directoryLabel: 'スキルディレクトリ',
        selectedFiles: '{{count}} ファイルが選択されました'
      },
      deleteDialog: {
        title: 'スキルの削除',
        descriptionWithName:
          'スキル「{{name}}」を削除しますか?これにより、スキルのすべてのバージョンとローカル ストレージ ファイルが削除されます。',
        descriptionFallback: 'このスキルを削除しますか?'
      }
    },
    skillCreator: {
      title: 'AI で Skill を作成',
      missingUuid: 'Skill ドラフト識別子がありません',
      loadFailed: 'Skill ドラフトの読み込みに失敗しました',
      messageFailed: 'メッセージの送信に失敗しました',
      generateFailed: 'Skill ファイルの生成に失敗しました',
      generateSuccess: 'Skill ファイルを生成しました',
      saveFailed: 'Skill ファイルの保存に失敗しました',
      saveSuccess: 'Skill ファイルを保存しました',
      publishFailed: 'Skill の作成に失敗しました',
      publishSuccess: 'Skill「{{name}}」を作成しました',
      chat: 'チャット',
      files: 'ファイル',
      you: 'あなた',
      assistant: 'AI アシスタント',
      interrupted: '応答が中断されました',
      emptyChat:
        'Skill に実行させたい内容を説明してください。AI が複数回の対話で要件を明確にします。',
      emptyFiles:
        '要件の確認後、「Skill を生成」をクリックしてファイルパッケージを作成します。',
      noFileSelected: 'ファイルが選択されていません',
      unsaved: '未保存',
      messagePlaceholder:
        '目標、入力、処理ルール、期待する出力を説明します。Command/Ctrl + Enter で送信します。',
      scriptReview: '生成されたすべてのスクリプトと実行動作を確認しました',
      actions: {
        send: '送信',
        generate: 'Skill を生成',
        regenerate: '再生成',
        save: 'ファイルを保存',
        publish: '作成を確認'
      },
      status: {
        draft: '要件を確認中',
        generating: '生成中',
        ready: 'ファイルの確認待ち',
        published: '作成済み',
        failed: '前回の生成に失敗'
      },
      stages: {
        thinking: 'AI が応答中',
        generating_files: 'ファイルパッケージを生成中',
        repairing_structure: 'ファイル構造を修復中'
      }
    },
    assetOptimizations: {
      title: 'Agent アセット最適化',
      description:
        '実行履歴からレビュー可能なドラフトを生成し、書き込みなしでリプレイ評価します。',
      loadFailed: 'アセット最適化レコードの読み込みに失敗しました',
      agentsLoadFailed: 'Agent の読み込みに失敗しました',
      generateFailed: 'アセット最適化の作成に失敗しました',
      generateStarted: 'アセット最適化を開始しました',
      applyFailed: '候補の適用に失敗しました',
      applySuccess: '候補を処理しました',
      dismissFailed: '候補の除外に失敗しました',
      dismissSuccess: '候補を除外しました',
      agentPlaceholder: '最適化する Agent を選択',
      agentEmpty: '利用可能な Agent がありません',
      generate: '手動最適化',
      generating: '開始中',
      empty: 'アセット最適化レコードがありません',
      apply: '候補を適用',
      review: 'レビュー済みにする',
      dismiss: '除外',
      failedCandidateUnavailable:
        '生成またはリプレイが完了していないため、この候補はプレビューのみで適用できません。',
      metrics:
        'サンプル {{samples}} · 成功 {{success}} · 問題 {{problems}} · 再試行 {{retries}} · リプレイ {{replay}}',
      table: {
        agent: 'Agent',
        trigger: 'トリガー',
        samples: 'サンプル',
        problems: '問題',
        status: 'ステータス',
        createdAt: '作成日時',
        actions: '操作'
      },
      trigger: { manual: '手動', automatic: '自動しきい値' },
      runStatus: {
        generating: '生成中',
        ready: 'レビュー待ち',
        failed: '失敗',
        completed: '完了'
      },
      candidateType: {
        prompt: 'Prompt',
        skill: 'Skill',
        knowledge: 'ナレッジ提案'
      },
      candidateStatus: {
        draft: 'ドラフト',
        applying: '公開中',
        conflict: '競合',
        applied: '適用済み',
        reviewed: 'レビュー済み',
        dismissed: '除外済み'
      },
      replay: {
        title: '書き込みなしの履歴リプレイ',
        estimated: 'AI 推定',
        passRate: '推定合格率',
        attempts: '予想試行回数',
        tokens: 'Token 変化',
        findings: '評価根拠'
      },
      applyDialog: {
        title: 'この候補を処理しますか？',
        description:
          'Prompt は Agent ドラフトに保存され、Agent は自動公開されません。',
        scriptDescription:
          'すべてのスクリプトを確認済みであることを確認してください。Skill バージョンが作成または公開されます。',
        scriptReviewed:
          'すべてのスクリプトファイルを確認し、公開可能であることを確認しました。',
        skillDescription: '対象 Skill の新しいバージョンを公開します。',
        newSkillDescription:
          '新しい Skill を作成し、現在の Agent にバインドします。',
        knowledgeDescription:
          'ナレッジ提案はレビュー済みになるだけで、ONES Wiki は変更されません。'
      },
      dismissDialog: {
        title: 'この候補を除外しますか？',
        description: '候補は履歴に残りますが、適用できなくなります。'
      }
    },
    loopRuntimeConfig: {
      title: 'ループエンジニアリング総合スイッチ',
      description: 'このチームで新しい自動修正試行を作成できるかを制御します。',
      switchLabel: 'ループエンジニアリングを有効化',
      switchHelp:
        '無効時、既存の Agent とワークフローは単発実行モードで動作します。',
      enabled: '有効',
      disabled: '無効',
      loadFailed: 'ループエンジニアリング設定の読み込みに失敗しました',
      saveFailed: 'ループエンジニアリング設定の保存に失敗しました',
      saveSuccess: 'ループエンジニアリング設定を保存しました'
    },
    aiModelConfig: {
      title: '組織のデフォルト AI モデル',
      description:
        '組織モデルでの Agent 実行、AI Skill 作成、プロンプト推奨、アセット最適化に使用します。指定した Agent Client のモデルは変更しません。',
      loadFailed: 'AI モデル設定の読み込みに失敗しました',
      saveFailed: 'AI モデル設定の保存に失敗しました',
      saveSuccess: 'AI モデル設定を保存しました',
      testFailed: 'モデル接続テストに失敗しました',
      testSuccess: 'モデル接続テストに成功しました',
      validationFailed:
        '有効な HTTPS URL、モデル名、0～2 の Temperature を入力してください。',
      baseURL: 'Base URL',
      model: 'モデル',
      keyConfigured: 'API Key 設定済み',
      keyMissing: 'API Key 未設定',
      keyPlaceholder: 'API Key を入力',
      keyReplacePlaceholder:
        '空欄なら現在のキーを保持し、新しい値で置き換えます',
      keyHelp: 'キーは暗号化され、保存後は再表示されません。',
      test: '接続テスト',
      testing: 'テスト中...'
    },
    workflowDetail: {
      missingUuid: 'ワークフロー UUID がありません',
      pageTitle: 'ワークフロー',
      loadFailed: 'ワークフローの詳細をロードできませんでした',
      optionsLoadFailed: 'セレクターデータのロードに失敗しました',
      projectsLoadFailed: 'プロジェクトのロードに失敗しました',
      issueTypesLoadFailed: '課題タイプをロードできませんでした',
      statusesLoadFailed: 'ステータスの読み込みに失敗しました',
      agentsLoadFailed: 'エージェントのロードに失敗しました',
      createNodeFailed: '実行ノードの作成に失敗しました',
      updateNodeFailed: '実行ノードの更新に失敗しました',
      createNodeSuccess: '実行ノードが作成されました',
      updateNodeSuccess: '実行ノードが更新されました',
      deleteNodeFailed: '実行ノードの削除に失敗しました',
      deleteNodeSuccess: '実行ノードが削除されました',
      empty: '実行ノードがありません',
      validation: {
        projectRequired: 'プロジェクトを選択してください',
        issueTypeRequired: '課題タイプを選択してください',
        statusRequired: 'トリガーステータスを選択してください',
        agentRequired: 'エージェントを選択してください',
        targetStatusRequired:
          'タスク成功後の遷移先ステータスを選択してください',
        targetStatusMustDiffer:
          '成功後の遷移先ステータスはトリガーステータスと異なる必要があります',
        maxAttemptsInvalid: '総試行回数は 1～5 の整数で指定してください',
        maxDurationInvalid: '総時間は 1～120 分の整数で指定してください',
        maxTokensInvalid: '総 Token は 1000～1000000 の整数で指定してください',
        escalationStatusRequired:
          '人による引き継ぎステータスを選択してください',
        escalationStatusMustDiffer:
          '引き継ぎステータスはトリガーおよび成功ステータスと異なる必要があります',
        incompleteSelection:
          'フォームデータが不完全です。オプションを再選択して、再試行してください。'
      },
      actions: {
        createNode: '新しい実行ノード',
        edit: '編集',
        delete: '削除',
        save: '保存',
        create: '作成する'
      },
      table: {
        index: '番号',
        project: 'プロジェクト',
        issueType: '課題タイプ',
        status: 'トリガーステータス',
        agent: 'バインドされたエージェント',
        postAction: '成功後のアクション',
        transitionTo: '「{{status}}」へ遷移',
        missingPostAction: '未設定（編集時に設定が必要）',
        revisionContext: '再作業コンテキスト',
        revisionEnabled: '有効',
        revisionDisabled: '無効',
        loopPolicy: '自動修正',
        loopEnabled: '最大 {{count}} 回',
        loopDisabled: '無効',
        actions: 'アクション'
      },
      dialog: {
        createTitle: '新しい実行ノード',
        editTitle: '実行ノードの編集',
        createDescription:
          'このノードのプロジェクト、課題タイプ、トリガーステータスを設定し、実行するエージェントとタスク成功後の遷移先ステータスを選択します。',
        editDescription:
          'この実行ノードのプロジェクト、課題タイプ、トリガーステータス、バインドされたエージェント、およびタスク成功後の遷移先ステータスを更新します。',
        projectLabel: 'プロジェクト',
        projectPlaceholderLoading: 'プロジェクトを読み込んでいます...',
        projectPlaceholder: 'プロジェクトを検索または選択します',
        projectEmpty: '利用可能なプロジェクトがありません',
        issueTypeLabel: '課題タイプ',
        issueTypePlaceholderLoading: '課題タイプを読み込んでいます...',
        issueTypePlaceholder: '課題タイプを検索または選択',
        issueTypeEmpty: '利用可能な課題タイプがありません',
        statusLabel: 'トリガーステータス',
        statusPlaceholderLoading: 'トリガーステータスを読み込み中...',
        statusPlaceholder: 'トリガーステータスを検索または選択します',
        statusEmpty: '利用可能なトリガーステータスがありません',
        agentLabel: 'エージェント',
        agentPlaceholderLoading: 'エージェントをロード中...',
        agentPlaceholder: 'エージェントを検索または選択します',
        agentEmpty: '一致するエージェントがありません',
        successTransitionLabel: 'タスク成功後の遷移先ステータス',
        successTransitionPlaceholder: '成功後の遷移先ステータスを選択',
        revisionContextLabel:
          '差し戻し時に過去の結果とレビューコメントを引き継ぐ',
        revisionContextHelp:
          '同じノードが再度トリガーされると、過去の結果と新しいレビューコメントを読み込みます。新しいコメントがない場合はブロックされます。',
        loopPolicyLabel: '自動修正ループを有効化',
        loopPolicyHelp:
          'チームの総合スイッチが有効で、公開済み Agent に受入基準がある場合、不合格の候補は次の試行に進みます。',
        maxAttemptsLabel: '総試行回数',
        maxDurationLabel: '総時間（分）',
        maxTokensLabel: '総 Token',
        escalationStatusLabel: '人による引き継ぎステータス',
        escalationStatusPlaceholder:
          'ループ予算を使い切った場合の引き継ぎステータスを選択',
        saving: '保存中...',
        creating: '作成...'
      },
      deleteDialog: {
        title: '実行ノードを削除しますか?',
        description:
          'これを元に戻すことはできません。このノードのプロジェクト、課題タイプ、トリガーステータス、およびバインドされたエージェントはすべて削除されます。'
      }
    },
    agentWorkspaceRepositories: {
      missingUuid: 'ワークスペース uuid がありません',
      pageTitle: 'ワークスペースリポジトリ',
      notFound: 'ワークスペースが見つかりません。',
      loadFailed: 'ワークスペースの詳細をロードできませんでした',
      workspaceListLoadFailed: 'ワークスペースのロードに失敗しました',
      saveRepositoryFailed: 'リポジトリの保存に失敗しました',
      updateRepositorySuccess: 'リポジトリが更新されました',
      createRepositorySuccess: 'リポジトリが作成されました',
      createRepositoriesSuccess: '{{count}} リポジトリが作成されました',
      deleteRepositoryFailed: 'リポジトリの削除に失敗しました',
      deleteRepositorySuccess: 'リポジトリが削除されました',
      saveAuthFailed: '認証の保存に失敗しました',
      saveAuthSuccess: '認証が更新されました',
      copyPublicKeyUnavailable:
        'このワークスペースにコピーできる SSH 公開キーがありません',
      copyPublicKeySuccess: 'SSH公開キーがコピーされました',
      copyPublicKeyFailed: 'SSH公開キーのコピーに失敗しました',
      generateSshKeyFailed: 'SSHキーの生成に失敗しました',
      generateSshKeySuccess: 'SSHキーが生成されました',
      regenerateSshKeySuccess: 'SSHキーが更新されました',
      empty: 'リポジトリはまだありません。まず 1 つ追加します。',
      validation: {
        repositoryUrlRequired: 'リポジトリの URL を入力してください',
        repositoryUrlListRequired:
          '少なくとも 1 つのリポジトリ URL を入力してください',
        repositoryUrlInvalid:
          '各行には有効な Git SSH または HTTPS URL が含まれている必要があります',
        httpsUsernameRequired: 'HTTPS ユーザー名を入力してください',
        sshUrlOnly:
          'このワークスペースは SSH 認証を使用するため、Git SSH URL のみが許可されます。',
        httpsUrlOnly:
          'このワークスペースは HTTPS 認証を使用するため、HTTPS リポジトリ URL のみが許可されます。',
        publicHttpsUrlOnly:
          'このワークスペースには認証が構成されていないため、パブリック HTTPS リポジトリ URL のみが許可されます。'
      },
      actions: {
        createRepository: '新しいリポジトリ',
        authSettings: '認証設定',
        edit: '編集',
        delete: '削除',
        save: '保存',
        copyPublicKey: '公開鍵をコピーする',
        copied: 'コピーされました',
        generateKey: 'キーの生成',
        regenerateKey: '再生成'
      },
      table: {
        url: 'リポジトリURL',
        browseUrl: 'URLを参照',
        actions: 'アクション',
        browseUrlUnavailable: '利用不可'
      },
      repositoryDialog: {
        createTitle: '新しいリポジトリ',
        editTitle: 'リポジトリの編集',
        urlListLabel: 'リポジトリ URL (1 行に 1 つ)',
        urlLabel: 'リポジトリURL'
      },
      authDialog: {
        title: '認証設定',
        typeLabel: '認証タイプ',
        typePlaceholder: '認証タイプを選択します',
        typeNone: '認証なし (パブリック HTTPS リポジトリ)',
        typeSsh: 'SSH公開鍵',
        typeHttps: 'HTTPS ユーザー名 + シークレット',
        sshPublicKeyLabel: 'SSH公開鍵',
        sshPublicKeyPlaceholder: 'SSH 公開キーはまだ生成されていません',
        sshPublicKeyDescription:
          'この公開キーをデプロイ キーまたは読み取り専用キーとしてターゲット リポジトリに追加します。',
        usernameLabel: 'ユーザー名',
        usernamePlaceholder: '例: git-bot',
        usernameDescription:
          '一般的な値は、Git ユーザー名、サービス アカウント名、または固定プレースホルダー ユーザー名です。',
        secretLabel: '秘密',
        secretPlaceholder:
          'トークン、PAT、または互換性のあるパスワードを入力してください',
        secretDescriptionKeep:
          '現在保存されているシークレットを保持するには、空のままにします。',
        secretDescriptionRequired:
          'Git HTTPS アクセスに使用できるシークレットを入力します。'
      },
      authDescription: {
        ssh: 'これは、デプロイ キーまたはマシン アカウントを使用してアクセスされる SSH リポジトリに使用します。',
        https:
          'これは、ユーザー名とトークン/PAT/パスワードを使用してアクセスされるプライベート HTTPS リポジトリに使用します。',
        none: 'これはパブリック HTTPS リポジトリにのみ使用してください。追加の認証詳細は提供されません。'
      },
      repositoryInputDescription: {
        ssh: 'このワークスペースは SSH 認証を使用するため、追加できるのは「git@...」または「ssh://...」リポジトリ URL のみです。',
        https:
          'このワークスペースは HTTPS 認証を使用するため、「https://...」リポジトリ URL のみを追加できます。',
        none: 'このワークスペースには認証が構成されていないため、パブリックの「https://...」リポジトリ URL のみを追加できます。'
      },
      generateSshKeyDialog: {
        titleGenerate: 'SSHキーを生成しますか?',
        titleRegenerate: 'SSHキーを再生成しますか?',
        descriptionGenerate:
          '生成後、新しい公開キーをデプロイキーとしてターゲット Git リポジトリに追加できます。',
        descriptionRegenerate:
          '再生成後、古い秘密キーはすぐに機能しなくなります。このワークスペースを使用して、すべての Git リポジトリで新しい公開キーを再構成する必要があります。',
        confirmGenerate: '生成する',
        confirmRegenerate: '再生成'
      },
      deleteDialog: {
        title: 'リポジトリを削除しますか?',
        description:
          'これにより、ワークスペースからリポジトリ設定が削除されますが、リモート リポジトリ自体には影響しません。'
      }
    },
    placeholder: {
      description: '空のページのプレースホルダー'
    }
  }
} as const;
