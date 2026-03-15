Feature: Tmux Keybinding Lifecycle
  As a developer using git-orchard
  I want orchard to manage its own tmux keybindings without permanently modifying my tmux config
  So that I get convenient shortcuts while orchard is active and a clean tmux environment when it is not

  # Test coverage status:
  # - Unit tests (shell.test.ts, tmux.test.ts): Scenarios 3-5 covered
  # - Integration tests: Not yet implemented
  # - E2E tests: Not yet implemented

  Background:
    Given the user has sourced the orchard shell function
    And git-orchard is installed and on PATH

  # ---------------------------------------------------------------------------
  # E2E: happy paths — full system, no mocking
  # ---------------------------------------------------------------------------

  @e2e
  Scenario: Prefix-o switches to the orchard session while orchard is running
    Given the orchard session is running
    And the user is in a different tmux session
    When the user presses "prefix o"
    Then the tmux client switches to the "orchard" session

  @e2e
  Scenario: Keybinding is removed when the orchard session is destroyed
    Given the orchard session is running
    And "prefix o" is bound to "switch-client -t orchard"
    When the user destroys the orchard session
    Then "prefix o" is no longer bound to "switch-client -t orchard"

  # ---------------------------------------------------------------------------
  # Integration: edge cases, error handling, module boundaries
  # ---------------------------------------------------------------------------

  @integration
  Scenario: Binding is set when the orchard session is created for the first time
    Given no tmux session named "orchard" exists
    And "prefix o" is not bound to anything
    When the orchard shell function creates the session
    Then "tmux bind-key o switch-client -t orchard" is executed

  @integration
  Scenario: Binding is set when attaching to an existing orchard session
    Given a tmux session named "orchard" already exists
    And the user is inside a different tmux session
    When the user runs "orchard"
    Then "tmux bind-key o switch-client -t orchard" is executed

  @integration
  Scenario: Original binding is saved before orchard overwrites it
    Given "prefix o" is bound to a custom user command "select-pane -t 0"
    When the orchard shell function runs
    Then the original binding "select-pane -t 0" is captured and stored
    And "tmux bind-key o switch-client -t orchard" is executed

  @integration
  Scenario: Original binding is restored when orchard exits
    Given "prefix o" was originally bound to "select-pane -t 0"
    And orchard saved that binding at startup
    When the orchard session is destroyed
    Then "tmux bind-key o select-pane -t 0" is executed
    And "prefix o" resumes its original behavior

  @integration
  Scenario: Key is unbound when orchard exits and there was no prior binding
    Given "prefix o" was not bound before orchard started
    And orchard recorded that no prior binding existed
    When the orchard session is destroyed
    Then "tmux unbind-key o" is executed
    And "prefix o" is not bound to anything

  @integration
  Scenario: User's tmux.conf file is never modified
    Given the user has a tmux.conf at "~/.tmux.conf"
    When the orchard shell function creates a session
    And the orchard session is later destroyed
    Then the contents of "~/.tmux.conf" are unchanged throughout

  @integration
  Scenario: Cleanup runs even if orchard exits abnormally
    Given the orchard session is running
    And "prefix o" is bound to "switch-client -t orchard"
    When the orchard session exits due to a crash or kill signal
    Then the keybinding cleanup still executes

  @integration
  Scenario: Binding is idempotent when orchard is launched multiple times
    Given the orchard session is already running
    And "prefix o" is already bound to "switch-client -t orchard"
    When the user runs "orchard" again from another terminal
    Then the saved original binding is not overwritten
    And the binding remains "switch-client -t orchard"

  # ---------------------------------------------------------------------------
  # Unit: pure logic, individual functions, branches
  # ---------------------------------------------------------------------------

  @unit
  Scenario: getShellFunction captures the existing binding before overwriting
    When getShellFunction is called
    Then the output contains a command to query the current "o" key binding
    And it stores the result before calling "bind-key o"

  @unit
  Scenario: getShellFunction sets the orchard keybinding
    When getShellFunction is called
    Then the output contains "bind-key o switch-client -t orchard"

  @unit
  Scenario: getShellFunction registers a trap or hook that restores the binding on exit
    When getShellFunction is called
    Then the output contains a cleanup mechanism triggered on session destroy
    And the cleanup restores the original binding or unbinds the key

  @unit
  Scenario: getShellFunction cleanup unbinds when no original binding existed
    Given the captured original binding is empty
    When the cleanup logic runs
    Then it executes "tmux unbind-key o"

  @unit
  Scenario: getShellFunction cleanup restores when an original binding existed
    Given the captured original binding is "select-pane -t 0"
    When the cleanup logic runs
    Then it executes "tmux bind-key o select-pane -t 0"
