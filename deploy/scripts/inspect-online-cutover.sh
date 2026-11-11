#!/usr/bin/env bash
# Read-only. Reports structure, not Compose/environment secret values.
set -euo pipefail
bash_code_dir="$HOME/ki-legends-aruba-staging"
if [ -f "$bash_code_dir/coolify-live-release" ]; then
 live_sha=$(cat "$bash_code_dir/coolify-live-release")
 [[ "$live_sha" =~ ^[0-9a-f]{40}$ ]] && echo "current_release=$live_sha"
fi
docker inspect --format 'service_workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}} config_file={{index .Config.Labels "com.docker.compose.project.config_files"}}' app-xh4qbckykxsq1iofxdoe5t3h
free -m
docker exec -i coolify php <<'PHP'
<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$s = App\Models\Service::query()->where('uuid', 'xh4qbckykxsq1iofxdoe5t3h')->firstOrFail();
$raw = Symfony\Component\Yaml\Yaml::parse($s->docker_compose_raw);
$env = $raw['services']['app']['environment'] ?? [];
$keys = array_is_list($env) ? array_map(fn($v)=>explode('=', $v, 2)[0], $env) : array_keys($env);
echo json_encode(['service_id'=>$s->id,'fields'=>array_keys($s->getAttributes()),'services'=>array_keys($raw['services'] ?? []),'app_keys'=>array_keys($raw['services']['app'] ?? []),'app_env_keys'=>$keys,'app_networks'=>$raw['services']['app']['networks']??null,'root_network_keys'=>array_keys($raw['networks']??[]),'methods'=>array_values(array_filter(get_class_methods($s),fn($name)=>preg_match('/parse|compose|save|deploy|start|restart/i',$name)))], JSON_UNESCAPED_SLASHES)."\n";
if (method_exists($s,'parse')) {
 $method = new ReflectionMethod($s,'parse');
 echo 'parse_source='.$method->getFileName().':'.$method->getStartLine().'-'.$method->getEndLine()."\n";
 $lines = file($method->getFileName());
 echo implode('',array_slice($lines,$method->getStartLine()-1,min(100,$method->getEndLine()-$method->getStartLine()+1)));
}
echo 'compose_parsing_version='.$s->compose_parsing_version."\n";
foreach (['saveComposeConfigs'] as $name) {
 $r = new ReflectionMethod($s,$name); $lines=file($r->getFileName());
 echo 'method_source='.$name."\n"; echo implode('',array_slice($lines,$r->getStartLine()-1,min(180,$r->getEndLine()-$r->getStartLine()+1)));
}
if (function_exists('serviceParser')) { $r=new ReflectionFunction('serviceParser'); echo 'service_parser='.$r->getFileName().':'.$r->getStartLine()."\n"; }
$e = new App\Models\EnvironmentVariable;
$r=new ReflectionClass($e);echo 'environment_model_source'."\n";echo implode('',array_slice(file($r->getFileName()),0,150));
foreach ($s->environment_variables ?? [] as $item) { echo json_encode(['key'=>$item->key,'version'=>$item->version,'literal'=>$item->is_literal,'runtime'=>$item->is_runtime,'buildtime'=>$item->is_buildtime])."\n"; }
echo json_encode(['environment_table'=>$e->getTable(),'environment_casts'=>array_keys($e->getCasts())])."\n";
PHP
docker exec coolify-db psql -X -U coolify -d coolify -At -c "select column_name,data_type from information_schema.columns where table_name='environment_variables' order by ordinal_position;"
