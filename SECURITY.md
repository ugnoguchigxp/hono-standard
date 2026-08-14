# Security Policy

## 対象

security fix は `main` と、保守中であることが各 branch の README に明記された variant を対象にします。古い tag は再現可能な固定 snapshot として保持しますが、過去の tag へ修正を backport する保証はありません。利用時は各系列の最新 semantic version を選んでください。

## 脆弱性の報告

脆弱性を見つけた場合は、公開 issue や pull request に詳細を投稿しないでください。GitHub repository の private vulnerability reporting が利用できる場合は `Security` の `Report a vulnerability` から報告してください。利用できない場合は `package.json` 記載の maintainer 連絡先へ送ってください。

報告には、可能な範囲で次を含めてください。

- 影響を受ける branch、tag、commit
- 再現手順または proof of concept
- 想定される影響と攻撃条件
- 回避策や修正案（分かる場合）

受領後は、再現確認、影響範囲の整理、修正と公開方法の調整を行います。修正が公開されるまでは詳細の公開を控えてください。
