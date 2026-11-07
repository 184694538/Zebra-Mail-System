<?php
namespace app\controller;

use think\Controller;

class Index
{
    public function themeSettings()
    {
        return json(['code' => 200, 'data' => \app\service\ThemeSettings::get()])->header(['Cache-Control' => 'no-store, private']);
    }

    public function index()
    {
        return '技术支持QQ 184694538';
    }
}