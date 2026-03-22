import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const historicalCases = [
  {
    title: "Предчувствие убийства",
    title_en: "Premonition of Assassination",
    person: "Авраам Линкольн | Abraham Lincoln",
    date_of_vision: "1865-04-11",
    date_of_event: "1865-04-14",
    vision_text: "Мне приснилось, что я брожу по Белому дому... Я зашел в Восточную комнату и увидел катафалк, охраняемый солдатами. 'Кто умер?' - спросил я. 'Президент, убит ассасином', - ответили мне.",
    vision_text_en: "I dreamed I was wandering through the White House... I entered the East Room and saw a catafalque guarded by soldiers. 'Who is dead?' I asked. 'The President, killed by an assassin', they replied.",
    event_description: "Авраам Линкольн был убит Джоном Уилксом Бутом в театре Форда через три дня после своего сна наяву.",
    event_description_en: "Abraham Lincoln was assassinated by John Wilkes Booth at Ford's Theatre three days following his lucid dream.",
    source_url: "https://www.history.com/news/did-abraham-lincoln-predict-his-own-death",
    source_name: "History",
    category: "political",
    match_score: 9.8,
    geography: "USA"
  },
  {
    title: "Крушение парохода «Пенсильвания»",
    title_en: "Explosion of the Pennsylvania",
    person: "Марк Твен (Сэмюэл Клеменс)",
    date_of_vision: "1858-05-15",
    date_of_event: "1858-06-13",
    vision_text: "Я увидел своего брата Генри в металлическом гробу, лежащем на стульях. На его груди лежал букет белых роз с одной красной розой в центре.",
    vision_text_en: "I saw my brother Henry in a metallic burial case resting on two chairs. A bouquet of white roses with a single red rose in the center lay upon his chest.",
    event_description: "Пароход взорвался. Генри Клеменс погиб от травм. Твен увидел точную картину из своего сна на похоронах брата.",
    event_description_en: "The steamboat exploded. Henry Clemens died from his injuries. Twain witnessed the exact scene from his dream at his brother's funeral.",
    source_url: "https://marktwainhouse.org/about/mark-twain/biography/",
    source_name: "Mark Twain House",
    category: "personal",
    match_score: 9.9,
    geography: "USA"
  },
  {
    title: "Падение Metrojet 9268",
    title_en: "Crash of Metrojet 9268",
    person: "Пассажирка рейса (аноним)",
    date_of_vision: "2015-10-30",
    date_of_event: "2015-10-31",
    vision_text: "Несколько человек публиковали тревожные посты перед полетом. Одна из стюардесс жаловалась на плохое предчувствие и странные сны про обломки в пустыне.",
    vision_text_en: "Several people posted disturbing posts before the flight. One flight attendant complained of a bad premonition and strange dreams about wreckage in the desert.",
    event_description: "Самолет Airbus A321 разбился в центральной части Синайского полуострова, Египет.",
    event_description_en: "An Airbus A321 crashed in the central part of the Sinai Peninsula, Egypt.",
    source_url: "https://en.wikipedia.org/wiki/Metrojet_Flight_9268",
    source_name: "Wikipedia",
    category: "aviation",
    match_score: 8.5,
    geography: "Egypt"
  },
  {
    title: "Гибель Титана",
    title_en: "The Wreck of the Titan",
    person: "Morgan Robertson",
    date_of_vision: "1898-01-01",
    date_of_event: "1912-04-14",
    vision_text: "Новелла «Тщетность, или Гибель Титана» описывала крупнейший британский лайнер 'Титан', который считался непотопляемым, но столкнулся с айсбергом в Северной Атлантике в апреле.",
    vision_text_en: "The novella 'Futility, or the Wreck of the Titan' described the largest British liner 'Titan', considered unsinkable, which hit an iceberg in the North Atlantic in April.",
    event_description: "Титаник, британский пассажирский лайнер, столкнулся с айсбергом в апреле ровно так же, как было описано в книге лондонского писателя за 14 лет до этого.",
    event_description_en: "The Titanic, a British passenger liner, struck an iceberg in April exactly as described in the London writer's book 14 years prior.",
    source_url: "https://en.wikipedia.org/wiki/The_Wreck_of_the_Titan:_Or,_Futility",
    source_name: "Wikipedia",
    category: "other",
    match_score: 9.6,
    geography: "Atlantic Ocean"
  },
  {
    title: "Сон Бисмарка",
    title_en: "Bismarck's Dream",
    person: "Отто фон Бисмарк | Otto von Bismarck",
    date_of_vision: "1863-01-01",
    date_of_event: "1870-07-19",
    vision_text: "Бисмарку приснилось, что он едет по узкой альпийской тропе, упирается в скалу, а затем бьет по ней кнутом, и скала рушится, открывая путь для Пруссии.",
    vision_text_en: "Bismarck dreamed he was riding on a narrow Alpine path, came up against a rock, and then struck it with his riding whip, causing the rock to crumble, opening a path for Prussia.",
    event_description: "Сон интерпретировался как предвестник успешной войны с Австрией и Францией, приведшей к объединению Германии.",
    event_description_en: "The dream was interpreted as an omen of a successful war with Austria and France, leading to the unification of Germany.",
    source_url: "https://press.princeton.edu/",
    source_name: "Historical Archives",
    category: "political",
    match_score: 7.2,
    geography: "Europe"
  },
  {
    title: "Видение кровавого потопа",
    title_en: "Vision of a Sea of Blood",
    person: "Карл Юнг | Carl Jung",
    date_of_vision: "1913-10-01",
    date_of_event: "1914-07-28",
    vision_text: "Я видел весь континент до Северного моря под водой. Вода превратилась в кровь, в которой плавали бесчисленные тела и руины цивилизации.",
    vision_text_en: "I saw the entire continent up to the North Sea submerged. The water turned to blood, in which floated countless bodies and the unroofed rubble of civilization.",
    event_description: "Началась Первая мировая война. Юнг воспринял это как предвидение коллективного бессознательного.",
    event_description_en: "World War I began. Jung perceived this as an anticipatory vision from the collective unconscious.",
    source_url: "https://carljungdepthpsychologysite.blog/",
    source_name: "Jung's Red Book",
    category: "war",
    match_score: 9.5,
    geography: "Europe"
  },
  {
    title: "Смерть Отцов-основателей",
    title_en: "Death of the Founding Fathers",
    person: "Джон Адамс | John Adams",
    date_of_vision: "1826-06-30",
    date_of_event: "1826-07-04",
    vision_text: "Джон Адамс перед смертью часто говорил, что чувствует, словно Джефферсон уходит с ним в одно время.",
    vision_text_en: "Before his death, John Adams often said he felt as though Jefferson was leaving with him at the same time.",
    event_description: "Адамс и Джефферсон, два бывших президента, умерли в один день — 4 июля 1826 года, ровно в 50-ю годовщину Декларации независимости.",
    event_description_en: "Adams and Jefferson, two former presidents, died on the same day—July 4, 1826, exactly on the 50th anniversary of the Declaration of Independence.",
    source_url: "https://www.history.com/",
    source_name: "History",
    category: "personal",
    match_score: 8.8,
    geography: "USA"
  },
  {
    title: "In Hoc Signo Vinces",
    title_en: "In Hoc Signo Vinces",
    person: "Константин Великий",
    date_of_vision: "0312-10-27",
    date_of_event: "0312-10-28",
    vision_text: "Константин посмотрел на солнце перед битвой на Мульвийском мосту и увидел крест света над ним, а вместе с ним греческие слова «Cим победиши» (In Hoc Signo Vinces).",
    vision_text_en: "Constantine looked up at the sun before the Battle of the Milvian Bridge and saw a cross of light above it, and with it the Greek words 'In this sign you shall conquer' (In Hoc Signo Vinces).",
    event_description: "Победа императора Константина привела к утверждению христианства в Римской империи.",
    event_description_en: "Emperor Constantine's victory led to the establishment of Christianity in the Roman Empire.",
    source_url: "https://en.wikipedia.org/wiki/Battle_of_the_Milvian_Bridge",
    source_name: "Wikipedia",
    category: "war",
    match_score: 9.0,
    geography: "Rome"
  },
  {
    title: "Крах Уолл-Стрит",
    title_en: "Wall Street Crash",
    person: "Эдгар Кейси | Edgar Cayce",
    date_of_vision: "1929-03-01",
    date_of_event: "1929-10-24",
    vision_text: "Во время транса он предупредил инвесторов о грядущей катастрофе на фондовых рынках из-за пузыря спекуляций: «Цены рухнут на Уолл-стрит».",
    vision_text_en: "During a trance, he warned investors of an impending disaster in the stock markets due to a bubble of speculation: 'Prices will crash on Wall Street'.",
    event_description: "Биржевой крах 1929 года положил начало Великой Депрессии.",
    event_description_en: "The stock market crash of 1929 marked the beginning of the Great Depression.",
    source_url: "https://edgarcayce.org/",
    source_name: "A.R.E.",
    category: "other",
    match_score: 9.7,
    geography: "USA"
  },
  {
    title: "Чемпион мира",
    title_en: "World Champion",
    person: "Мухаммед Али | Muhammad Ali",
    date_of_vision: "1954-01-01",
    date_of_event: "1964-02-25",
    vision_text: "Начиная с подросткового возраста, Али постоянно снилось и виделось, как он стоит над поверженным противником, одетый в золото, и толпа ревет его имя.",
    vision_text_en: "Starting in his teens, Ali had recurring lucid dreams and visions of himself standing over a fallen opponent, dressed in gold, with the crowd roaring his name.",
    event_description: "Он победил Санни Листона и стал чемпионом мира в тяжелом весе. Эта сцена повторилась в реальности.",
    event_description_en: "He defeated Sonny Liston and became the heavyweight champion of the world. This scene was recreated in reality.",
    source_url: "https://www.biography.com/",
    source_name: "Biography",
    category: "personal",
    match_score: 7.9,
    geography: "USA"
  }
];

async function seed() {
  console.log('Seeding historical_cases...');
  
  for (const item of historicalCases) {
    const { error } = await supabase
      .from('historical_cases')
      .insert(item)
      .select();

    if (error) {
      console.error('Error inserting:', item.title, error);
    } else {
      console.log('Inserted:', item.title);
    }
  }
  
  console.log('Done seeding historical_cases.');
}

seed();
