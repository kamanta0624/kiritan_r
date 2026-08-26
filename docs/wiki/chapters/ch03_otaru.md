---
id: ch03_otaru
title: ''
category: story
order: 3
events:
  - id: ev_otaru_phase1_start
    trigger: player_turn
    priority: 1000
    maxOccurrences: 1
  - id: ev_otaru_expand_1
    trigger: player_turn
    priority: 1000
    maxOccurrences: 1
  - id: ev_otaru_expand_2
    trigger: player_turn
    priority: 1000
    maxOccurrences: 1
  - id: ev_otaru_conquered
    trigger: player_turn
    priority: 1000
    maxOccurrences: 1
  - id: ev_otaru_expand_3
    trigger: player_turn
    priority: 900
    maxOccurrences: 1
  - id: ev_otaru_declare_war
    trigger: player_turn
    priority: 850
    maxOccurrences: 1
  - id: ev_otaru_war_flag_sync
    trigger: player_turn
    priority: 800
    maxOccurrences: 1
  - id: ev_otaru_max_check
    trigger: player_turn
    priority: 500
    maxOccurrences: 1
tags:
  - type/chapter
  - chapter/ch03_otaru
---
