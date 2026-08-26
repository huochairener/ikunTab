from __future__ import annotations
"""启动时注入演示数据：demo / demo123456。"""
import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Bookmark,
    Group,
    SearchEngine,
    User,
    UserSetting,
    Widget,
)
from .security import hash_password

log = logging.getLogger(__name__)

DEMO_BMS = [
    ("生活", "🌿", 0, [
        ("哔哩哔哩", "https://www.bilibili.com"),
        ("微博", "https://weibo.com"),
        ("知乎", "https://www.zhihu.com"),
        ("淘宝", "https://www.taobao.com"),
    ]),
    ("工作", "💼", 1, [
        ("GitHub", "https://github.com"),
        ("Gitee", "https://gitee.com"),
        ("Stack Overflow", "https://stackoverflow.com"),
    ]),
    ("娱乐", "🎮", 2, [
        ("网易云音乐", "https://music.163.com"),
        ("豆瓣", "https://www.douban.com"),
    ]),
]

SENTENCE_CFG = (
    '{"outerUrl":"https://www.widgets.link/#/view/sentence-01'
    '?ff=1&p=10&bc=%23FFFFFFFF&r=16&st=&tc=%23000000FF&sfs=15'
    '&sq=1&sp=12&sofs=14&sa=right&cm=1&ls=0",'
    '"clickBehavior":"iframe","popupUrl":""}'
)

DEFAULT_ENGINES = [
    ("Bing", "https://www.bing.com/search?q={q}", "🔍", 1),
    ("Google", "https://www.google.com/search?q={q}", "G", 0),
    ("百度", "https://www.baidu.com/s?wd={q}", "百", 0),
]


async def run_seed(db: AsyncSession) -> None:
    cnt = await db.scalar(select(User.id).limit(1))
    if cnt:
        log.info("seed: 已有用户，跳过")
        return

    demo = User(username="demo", email="demo@ikun.tab", password=hash_password("demo123456"))
    db.add(demo)
    await db.flush()
    uid = demo.id

    # 分组 + 书签
    groups: List[Group] = []
    for name, icon, sort, items in DEMO_BMS:
        g = Group(user_id=uid, name=name, icon=icon, sort_order=sort)
        db.add(g)
        await db.flush()
        groups.append(g)
        for i, (bm_name, url) in enumerate(items):
            db.add(Bookmark(
                user_id=uid, group_id=g.id, parent_id=None, type=0,
                name=bm_name, url=url, icon_type="favicon", sort_order=i,
            ))

    # 组件
    db.add(Widget(
        user_id=uid, group_id=groups[0].id, type="custom", name="每日一句",
        rows=2, cols=2, config=SENTENCE_CFG, sort_order=0, enabled=1,
    ))
    db.add(Widget(
        user_id=uid, group_id=groups[0].id, type="clock", name="时钟",
        rows=1, cols=1, config="{}", sort_order=1, enabled=1,
    ))
    db.add(Widget(
        user_id=uid, group_id=groups[1].id, type="hotlist", name="微博热榜",
        rows=2, cols=1, config='{"source":"weibo"}', sort_order=0, enabled=1,
    ))

    # 搜索引擎
    engine_ids = []
    for name, tpl, icon, is_def in DEFAULT_ENGINES:
        e = SearchEngine(
            user_id=uid, name=name, url_template=tpl, icon=icon, is_default=is_def,
        )
        db.add(e)
        await db.flush()
        engine_ids.append(e.id)

    # 设置
    db.add(UserSetting(
        user_id=uid, theme="light", background_type="bing",
        auto_focus_search=1, search_engine_id=engine_ids[0],
    ))

    await db.commit()
    log.info("seed: 演示数据注入完成，登录账号 demo / demo123456")
