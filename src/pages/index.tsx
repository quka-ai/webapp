import { Button, cn, Image, Link, Snippet } from '@heroui/react';
import { Icon } from '@iconify/react';
import { t } from 'i18next';
import { useState } from 'react';

import DotPattern from '@/components/dot-pattern';
import { DiscordIcon, GithubIcon, XiaohongshuLogo } from '@/components/icons';
import AnimatedBeamMultipleOutput from '@/components/index-beam';
import BentoDemo from '@/components/index-bento-gird';
import { Name } from '@/components/logo';
import MorphingText from '@/components/morphing-text';
import NeonGradientCard from '@/components/neon-gradient-card';
import Particles from '@/components/particles';
import { subtitle, title } from '@/components/primitives';
import SafariBox from '@/components/safari-box';
import { VelocityScroll } from '@/components/scroll-based-velocity';
import ShineBorder from '@/components/shine-border';
import ShinyText from '@/components/shiny-text';
import SparklesText from '@/components/sparkles-text';
import TextRevealByWord from '@/components/text-reveal';
import DefaultLayout from '@/layouts/default';

export default function IndexPage() {
    const [demoLoaded, setDemoLoaded] = useState(false);
    function demoOnLoad() {
        setDemoLoaded(true);
    }
    return (
        <DefaultLayout>
            <section className="flex h-full flex-col items-center gap-4 py-10">
                <div className="flex flex-col justify-center items-center lg:py-16">
                    <div className="z-10 mb-10 flex items-center justify-center">
                        <div
                            className={cn(
                                'group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800'
                            )}
                        >
                            <ShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                                <span>✨ Quick start your cyber memory</span>
                            </ShinyText>
                        </div>
                    </div>

                    <div className="inline-block max-w-2xl text-center justify-center">
                        <span className={title()}>{t('IndexH1')}&nbsp;</span>
                        <span className={title({ color: 'violet' })}>{Name}&nbsp;</span>
                        <br />
                        <br />
                        <span className={title()}>{t('Build your')}</span>
                        <br />
                        <br />
                        <span className={title()}>{t('Second')}</span>
                        <span className={title({ color: 'violet' })}> {t('Brain')}</span>
                        {/* <div className={subtitle({ class: 'mt-4' })}>To reach beyond your limits</div> */}
                    </div>

                    <div className="flex gap-3 mt-10 mb-24">
                        <Link href="/login">
                            <Button color="primary" className="flex gap-2  items-center" size="lg">
                                {t('QuickStart')}
                            </Button>
                        </Link>

                        {/* <Link href="https://discord.gg/YGrbmbCVRF">
                        <Button color="primary" className="flex gap-2  items-center">
                            Document
                        </Button>
                    </Link>
                    <Link href="https://github.com/breeew/brew">
                        <Button color="primary" className="flex gap-2  items-center" variant="bordered">
                            <GithubIcon />
                            Github
                        </Button>
                    </Link> */}
                    </div>
                </div>

                {/* <div className="mt-8">
                    <Snippet hideCopyButton hideSymbol variant="bordered">
                        <span className="flex items-center gap-2">
                            <div>Join us community </div>
                            <Button size="sm" color="primary" className="flex gap-2  items-center" radius="full" variant="ghost">
                                <DiscordIcon className=" float-start" />
                                Discord
                            </Button>
                        </span>
                    </Snippet>
                </div> */}

                {demoLoaded && (
                    <NeonGradientCard className="justify-center text-center w-full max-w-[1600px]">
                        <Image src="demo-screen.png" className="w-full" />
                    </NeonGradientCard>
                )}

                <Image src="demo-screen.png" className="hidden" onLoad={() => demoOnLoad()} />

                <div id="feature" className="mt-32 mb-10 relative flex  w-full md:w-1/2 flex-col items-center justify-center overflow-hidden rounded-lg bg-background md:shadow-xl">
                    <DotPattern className={cn('[mask-image:radial-gradient(260px_circle_at_center,white,transparent)]')} />
                    <p className="z-10 whitespace-pre-wrap text-center text-5xl font-medium tracking-tighter text-black dark:text-white">{t('Community')}</p>
                    <p className="z-10 whitespace-pre-wrap text-center text-lg font-medium tracking-tighter text-zinc-400 mt-4">{t('siteCommunityDescription')}</p>

                    <div className="flex flex-col md:flex-row gap-10 my-10">
                        <Link target="_blank" href="https://github.com/breeew/brew">
                            <Button startContent={<Icon icon="uil:github" height={50} className="" />} variant="light" className="text-2xl font-semibold">
                                GitHub
                            </Button>
                        </Link>

                        <Link target="_blank" href="https://discord.gg/PUGpfmVBWq">
                            <Button variant="light" startContent={<Icon icon="carbon:logo-discord" height={50} />} className="text-2xl font-semibold">
                                Discrod
                            </Button>
                        </Link>

                        <Link target="_blank" href="https://www.xiaohongshu.com/user/profile/638bf78a000000001f01d0e6">
                            <Button variant="light" startContent={<XiaohongshuLogo className="p-1" size={50} />} className="text-2xl font-semibold">
                                小红书
                            </Button>
                        </Link>
                    </div>
                </div>
                <div id="feature" className="my-10 relative flex h-[160px] w-full md:w-1/2 flex-col items-center justify-center overflow-hidden rounded-lg bg-background md:shadow-xl">
                    <p className="z-10 whitespace-pre-wrap text-center text-5xl font-medium tracking-tighter text-black dark:text-white">{t('Features')}</p>
                    <p className="z-10 whitespace-pre-wrap text-center text-lg font-medium tracking-tighter text-zinc-400 mt-4">{t('siteFeaturesDescription')}</p>
                    <DotPattern className={cn('[mask-image:radial-gradient(260px_circle_at_center,white,transparent)]')} />
                </div>

                <div className="max-w-[1200px]">
                    <BentoDemo />
                </div>

                <TextRevealByWord className={title()} text="Oblivion Your Memory to reach beyond your limits." />
            </section>
            <Particles className="absolute inset-0 z-0" quantity={50} ease={10} refresh />
        </DefaultLayout>
    );
}
