#!/usr/bin/env bash
set -euo pipefail

command="${1:?Expected start, wait, collect, or stop}"
profile_dir="${2:?Expected a profiling directory}"
container_name=nitro-redroid
serial=127.0.0.1:5555
image="${REDROID_IMAGE:?Expected a prepared Redroid image}"
boot_timeout_seconds=300

mkdir -p "$profile_dir"
profile_dir="$(realpath "$profile_dir")"
timings_file="$profile_dir/redroid-timings.tsv"
status_file="$profile_dir/redroid-status"

now_ms() {
  python3 "$GITHUB_WORKSPACE/scripts/ci/monotonic-ms.py"
}

record_timing() {
  local phase="$1"
  local started_ms="$2"
  local finished_ms="$3"
  local duration_ms=$((finished_ms - started_ms))
  printf '%s\t%s\t%s\t%s\n' "$phase" "$started_ms" "$finished_ms" "$duration_ms" >> "$timings_file"
}

watch_exit() {
  local exit_code="$1"
  if [[ "$exit_code" -ne 0 ]]; then
    printf 'failed\n' > "$status_file"
  fi
}

watch_boot() {
  trap 'watch_exit $?' EXIT
  local launch_started_ms
  read -r launch_started_ms < "$profile_dir/redroid-launch-started-ms"
  local deadline_ms=$((launch_started_ms + boot_timeout_seconds * 1000))
  local current_ms
  local running
  local boot_completed

  while true; do
    current_ms="$(now_ms)"
    if (( current_ms >= deadline_ms )); then
      echo "Android did not become ready within ${boot_timeout_seconds}s."
      exit 1
    fi

    running="$(docker inspect --format '{{.State.Running}}' "$container_name")"
    if [[ "$running" != true ]]; then
      echo 'The Redroid container stopped before Android became ready.'
      exit 1
    fi

    timeout 10s adb connect "$serial" || true
    boot_completed=''
    if boot_completed="$(timeout 10s adb -s "$serial" shell getprop sys.boot_completed)"; then
      boot_completed="${boot_completed//$'\r'/}"
      if [[ "$boot_completed" == 1 ]]; then
        if timeout 10s adb -s "$serial" shell cmd package list packages > "$profile_dir/redroid-packages.txt"; then
          current_ms="$(now_ms)"
          record_timing android_boot "$launch_started_ms" "$current_ms"
          printf 'ready\n' > "$status_file"
          echo 'Android boot completed and the package manager is responsive.'
          return
        fi
      fi
    fi
    sleep 2
  done
}

case "$command" in
  start)
    printf 'phase\tstarted_ms\tfinished_ms\tduration_ms\n' > "$timings_file"
    rm -f "$status_file"

    started_ms="$(now_ms)"
    sudo modprobe binder_linux devices=binder,hwbinder,vndbinder
    finished_ms="$(now_ms)"
    record_timing binder_setup "$started_ms" "$finished_ms"

    started_ms="$(now_ms)"
    docker pull --platform linux/amd64 "$image"
    finished_ms="$(now_ms)"
    record_timing image_pull "$started_ms" "$finished_ms"
    docker image inspect "$image" > "$profile_dir/redroid-image.json"

    started_ms="$(now_ms)"
    kernel_release="$(uname -r)"
    docker create --name nitro-redroid-modules "$image"
    module_path="/opt/nitro/modules/$kernel_release/ashmem_linux.ko"
    if docker cp "nitro-redroid-modules:$module_path" "$profile_dir/ashmem_linux.ko"; then
      docker rm --volumes nitro-redroid-modules
      modinfo "$profile_dir/ashmem_linux.ko" > "$profile_dir/ashmem-module.txt"
      module_vermagic="$(modinfo --field vermagic "$profile_dir/ashmem_linux.ko")"
      module_kernel="${module_vermagic%% *}"
      if [[ "$kernel_release" == "$module_kernel" ]]; then
        sudo insmod "$profile_dir/ashmem_linux.ko"
        sudo udevadm settle
        test -c /dev/ashmem
      else
        echo "Module kernel $module_kernel does not match runner kernel $kernel_release." >&2
        exit 1
      fi
    else
      echo "The prepared image does not support runner kernel $kernel_release." >&2
      exit 1
    fi
    finished_ms="$(now_ms)"
    record_timing kernel_module_load "$started_ms" "$finished_ms"

    started_ms="$(now_ms)"
    printf '%s\n' "$started_ms" > "$profile_dir/redroid-launch-started-ms"
    docker run --detach --privileged --platform linux/amd64 \
      --name "$container_name" \
      --publish 127.0.0.1:5555:5555 \
      "$image" \
      androidboot.use_memfd=true \
      androidboot.redroid_gpu_mode=guest \
      androidboot.redroid_width=1080 \
      androidboot.redroid_height=2400 \
      androidboot.redroid_dpi=420
    finished_ms="$(now_ms)"
    record_timing container_start "$started_ms" "$finished_ms"

    nohup bash "$0" watch "$profile_dir" > "$profile_dir/redroid-boot.log" 2>&1 < /dev/null &
    printf '%s\n' "$!" > "$profile_dir/redroid-watcher-pid"
    ;;
  watch)
    watch_boot
    ;;
  wait)
    started_ms="$(now_ms)"
    deadline_ms=$((started_ms + (boot_timeout_seconds + 30) * 1000))
    while [[ ! -f "$status_file" ]]; do
      current_ms="$(now_ms)"
      if (( current_ms >= deadline_ms )); then
        echo 'The Redroid boot watcher did not report a result.' >&2
        exit 1
      fi
      sleep 1
    done
    finished_ms="$(now_ms)"
    record_timing remaining_boot_wait "$started_ms" "$finished_ms"
    read -r status < "$status_file"
    cat "$profile_dir/redroid-boot.log"
    [[ "$status" == ready ]]
    ;;
  collect)
    docker inspect "$container_name" > "$profile_dir/redroid-container.json" || true
    docker logs --timestamps "$container_name" > "$profile_dir/redroid-container.log" 2>&1 || true
    timeout 15s docker exec "$container_name" getprop > "$profile_dir/redroid-container-properties.txt" 2>&1 || true
    timeout 15s docker exec "$container_name" logcat -d > "$profile_dir/redroid-container-logcat.txt" 2>&1 || true
    adb devices -l > "$profile_dir/adb-devices.txt" 2>&1 || true
    timeout 15s adb -s "$serial" logcat -d > "$profile_dir/redroid-logcat.txt" 2>&1 || true
    timeout 10s adb -s "$serial" shell getprop > "$profile_dir/redroid-properties.txt" 2>&1 || true
    { sudo dmesg --time-format iso; } > "$profile_dir/redroid-kernel.txt" 2>&1 || true
    ;;
  stop)
    if [[ ! -f "$status_file" && -f "$profile_dir/redroid-watcher-pid" ]]; then
      read -r watcher_pid < "$profile_dir/redroid-watcher-pid"
      kill "$watcher_pid" 2>/dev/null || true
    fi
    docker rm --force "$container_name" || true
    docker rm --force --volumes nitro-redroid-modules 2>/dev/null || true
    ;;
  *)
    echo "Unknown Redroid command: $command" >&2
    exit 2
    ;;
esac
